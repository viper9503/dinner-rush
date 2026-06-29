# Dinner Rush - Interview Prep

Private prep notes for the live walkthrough. Everything here is grounded in the
actual code with `file:line` pointers so you can defend any claim. Not meant to
be read aloud verbatim; it is your map and your answer bank.

> Note: this file is your prep, not a graded deliverable. Consider keeping it out
> of the repo you submit (or leaving it in is fine, it only shows your reasoning).

---

## 0. One-command run + URL cheat sheet

```bash
docker compose up --build
```

| What | URL | Port note |
|------|-----|-----------|
| Ops dashboard (the money view) | http://localhost:8080 | React + Vite + nginx |
| Customer storefront | http://localhost:8090 | Next.js |
| Grafana (provisioned) | http://localhost:3000 | admin/admin |
| Prometheus | http://localhost:9090 | scrapes all 7 services @5s |
| RabbitMQ mgmt | http://localhost:15672 | dinner/dinner |
| ingestion / orchestrator | :8001 / :8002 | `POST /orders`, `/orders/{id}` |
| restaurant / courier / payment | :8003 / :8004 / :8007 | `/control` to break/tune |
| load-gen | :8006 | `/rush`, `/baseline`, `/stop` |

Correctness checker (run live after chaos): `./scripts/check.sh`

---

## 1. The 60-second opening (say this first)

"This is the order pipeline for a food-delivery platform. A customer hits Place
Order and we drive it `placed -> confirmed -> preparing -> ready ->
out_for_delivery -> delivered`, while handing fulfillment to deliberately flaky
payment, restaurant, and courier systems that are slow, rate-limit, and fall over
at random.

It is built as **seven small FastAPI services over RabbitMQ**, with **Postgres**
for durable state and a **transactional outbox**, and **Redis** as a fast
first-line cache. There are two front ends: a live **ops dashboard** and a
customer **storefront**. Everything comes up with one `docker compose up`.

The whole design is about staying correct under burst and partial failure: **no
order lost, none processed twice, and it recovers on its own** when a downstream
dies and comes back. That last property is the part I optimized hardest for,
because it is what the brief is really testing."

Then offer the demo immediately. Show, don't tell.

---

## 2. Architecture and the shape of the system

```
 load-gen --HTTP--> ingestion --(order.placed)--> [RabbitMQ] --> orchestrator
   storefront --HTTP-/                                              |  ^  |
                                  HTTP (idempotent, retried) --------+  |  +--> (order.transition)
                                  /v1/payment_intents | /fulfill        |          |
                                  payment   restaurant   courier        |          v
                                  (flaky)   (flaky)      (flaky)      retry/DLQ   dashboard-api --SSE--> dashboard-web
```

**Seven backend services, each its own container and database** (no shared tables):

- **ingestion-svc** - front door. Validates, persists, publishes `order.placed`. Never blocks on a downstream, so a burst is bounded by a local DB write only.
- **orchestrator-svc** - the brain. Owns the lifecycle state machine, consumes commands, calls downstreams, persists every transition.
- **payment-svc** - simulated Stripe-style provider (PaymentIntents + Idempotency-Key). Authorize before `confirmed`; a declined card fails the order.
- **restaurant-svc / courier-svc** - simulated external fulfillment: slow, rate-limited, randomly failing, can fall over and recover. Tunable live via `/control`.
- **dashboard-api** - aggregates a live snapshot, pushes it to the browser over SSE.
- **load-gen** - controllable traffic generator (baseline drip + dinner-rush spike).

Plus **dashboard-web** (React ops UI) and **customer-web** (Next.js storefront).
Infra: **RabbitMQ, Postgres, Redis, Prometheus, Grafana.**

### Why microservices here (and the honest trade-off)

> This is a judgment question. Lead with the reason, then volunteer the trade-off
> before they push - that is the signal they want.

"The boundaries are drawn at **real failure lines**. A restaurant system falling
over must not take ingestion down. Ingestion has to scale on write volume,
independently of the slow fulfillment fan-out. And the downstreams genuinely
*are* separate external systems, so simulating them as separate services is
honest to the domain.

The honest trade-off: a small team shipping this for real would often start with
a **modular monolith** and split later, because the operational cost of seven
services (deploys, network calls, partial failure) is real. I chose
microservices here specifically because **resilience under partial failure is the
entire point of the exercise** - the architecture itself is part of what's being
evaluated, and you can't demonstrate failure isolation in a single process.
'Microservices because microservices' would be the wrong answer."

---

## 3. The stack: every choice, why, what I rejected, how to defend

> The headline ask. For each: the choice, the reason, the rejected alternative,
> and the attack you'll get with a one-line rebuttal.

### Language/framework: Python + FastAPI
- **Why:** Small, readable services that are quick to walk through live. First-class `async`/`await` is a natural fit for the I/O-bound fan-out to slow downstreams (one event loop fanning many concurrent HTTP calls). Pydantic gives typed payloads at every boundary.
- **Rejected:** **Go** (more boilerplate for a demo, though better raw throughput); **Node/NestJS** (heavier DI framework; I wanted one async runtime, not two).
- **Attack -> rebuttal:** *"Python is slow / GIL?"* -> "This workload is I/O-bound, not CPU-bound - we're waiting on Postgres and on deliberately-slow downstreams, so the GIL is not the bottleneck. Throughput scales by running more orchestrator consumers; the design already supports it via `FOR UPDATE SKIP LOCKED` on the outbox and per-message acks. If a stage were CPU-heavy I'd move that service to Go, not rewrite everything."

### Broker: RabbitMQ
- **Why:** The grading criteria (no-lost / no-double / DLQ) map **one-to-one** onto RabbitMQ primitives: per-message **manual acks**, a **dead-letter exchange**, and **per-queue TTL** for timed retries. It is the most direct expression of the requirements.
- **Rejected:** **Redis Streams** (consumer-group acks and DLQ are more hand-rolled); **Kafka** (partition/offset model and heavier dead-letter ergonomics are overkill for a single-machine demo; great for replayable event logs, not for per-message retry/ack work queues); **NATS** (less familiar DLQ story).
- **Topology** (`libs/drcommon/drcommon/broker.py:4-27`): exchanges `dinner.events` (topic, facts), `dinner.work` (direct, commands), `dinner.retry` (direct, delayed), `dinner.dlx` (fanout, parking). Queues `q.order.advance`, `q.order.advance.retry` (TTL=`RETRY_QUEUE_TTL_MS` dead-lettering back to `dinner.work`), `q.order.dlq`.
- **Attack -> rebuttal:** *"Why not Kafka for throughput?"* -> "Kafka is a replayable log; my problem is a work queue with per-message retry, dead-lettering, and selective replay. RabbitMQ models that natively. Kafka would make per-message DLQ and retry hand-rolled. Single-machine, RabbitMQ is the lower-friction fit."

### State store: Postgres
- **Why:** One store for three jobs - **durable order state**, the **transactional outbox**, and the **idempotency authority** (unique constraints). ACID transactions let me commit a state change, its dedup record, and the outbound event **atomically** (`services/orchestrator/app/main.py:375-405`).
- **Rejected:** A NoSQL store (would lose the cross-row transaction that makes the outbox safe). Separate stores per concern (unnecessary; one Postgres per service is simpler and the transaction boundary is the whole point).
- **Attack -> rebuttal:** *"Postgres as a queue is an anti-pattern."* -> "I'm not using Postgres as the queue - RabbitMQ is the queue. Postgres holds the **outbox**, which is the standard pattern to avoid the dual-write problem: I write state and the to-be-published event in one transaction, and a relay ships it afterward. That's the opposite of using the DB as a broker."

### Cache / first-line dedup / rate-limit: Redis
- **Why:** A fast, **non-authoritative** check to cheaply skip work that's already done, plus rate-limit counters and a hot dashboard cache. Explicitly **not** the source of truth.
- **Critical framing:** Redis is **fail-open and best-effort** (`libs/drcommon/drcommon/idempotency.py:57-101`). If Redis is wiped or down, `is_done()` returns `False`, `allow()` returns `True`, and the **Postgres** unique constraint still catches every duplicate. "A wiped Redis is exactly the failure the graders induce, so it can never be the only thing standing between an order and a double charge."
- **Attack -> rebuttal:** *"What if Redis lies (says done when it isn't)?"* -> "It can't cause a double effect: a `True` from Redis is only trusted after we confirm the op also exists in Postgres (`orchestrator/app/main.py:305-310`). Redis only ever lets us *skip* a Postgres round-trip; the durable check is still authoritative."

### Ops frontend: React + Recharts over SSE
- **Why:** The dashboard is **one-directional** server->browser streaming, which is exactly what **SSE** is for - simpler than WebSocket (no upgrade handshake, auto-reconnect built in, plain HTTP). Recharts for quick, readable charts.
- **Rejected:** **WebSocket** (bidirectional, more machinery than a read-only feed needs); polling (wasteful, laggy under load).
- **Attack -> rebuttal:** *"SSE limitations?"* -> "Single HTTP connection, server->client only, ~6-connection-per-domain browser cap. All fine here: one stream, read-only, one tab. If the dashboard needed to send commands back I'd still keep SSE for the feed and use plain POSTs for control, which is exactly what I do."

### Customer storefront: Next.js (stateless adapter)
- **Why:** Reused an existing polished storefront intact and **repointed it at the same ingestion + orchestrator APIs**. It owns **no database** - checkout calls ingestion, the tracker reads the orchestrator, so a customer order travels the identical outbox+idempotency path as load-gen traffic.
- **The one interesting bit:** a catering cart can span several restaurants, but a pipeline order is single-restaurant, so checkout **fans a cart out into one order per restaurant** (each with its own derived idempotency key) and the tracker recomposes them into one view (overall status = least-advanced). The cart "id" is a stateless token (the order ids encoded), so no DB is needed to map a cart back to its orders.
- **Attack -> rebuttal:** *"Why two frontend frameworks?"* -> "Pragmatic reuse. The ops view is a tiny SSE consumer, so React+Vite+nginx is right-sized. The storefront already existed as a Next.js app, so reusing it intact and keeping it **stateless** was faster and added no architectural surface - it can't bypass the pipeline because it has no backend of its own. Greenfield, I'd pick one framework."

### Observability: Prometheus + Grafana
- **Why:** Industry-standard pull-based metrics. Every service exposes `/metrics`; Prometheus scrapes all seven every 5s; **Grafana is provisioned via config** so the dashboard comes up populated, no manual setup.
- **Rejected:** Hosted/proprietary APM (breaks the offline single-machine constraint).

### Packaging: one `docker-compose.yml`
- **Why:** The brief requires single-machine `docker compose up` with no post-start steps. Migrations run on startup; `depends_on` + healthchecks order the boot; every tunable is an env var with a documented default.

---

## 4. Correctness under failure (THE core grading criterion)

Three guarantees. Know the file:line for each.

### 4a. No lost orders (durability)

1. **Persist before ack.** Ingestion commits the order **before** returning `202` (`services/ingestion/app/main.py:97-138`). The idempotency key is a `UNIQUE` column; a retried POST returns the original `order_id` with `200` (duplicate) instead of creating a second order.
2. **Transactional outbox** (`libs/drcommon/drcommon/outbox.py`). The state change **and** the outbound event are written in the **same transaction** (`enqueue()` appends to the `outbox` table inside the caller's tx). This kills the dual-write problem: we never publish-then-crash with unsaved state, and never save-then-crash with an unpublished event.
3. **Relay with publisher confirms** (`outbox.py:100-131`). A background relay polls unpublished rows with `SELECT ... FOR UPDATE SKIP LOCKED`, publishes with **publisher confirms** (the publish `await` doesn't return until the broker has persisted the `PERSISTENT` message), then stamps `published_at`. Crash between publish and stamp -> the row is found again and republished (at-least-once to the broker).
4. **Manual acks** (`broker.py:170-171`, `no_ack=False`). Consumers ack **only after** the durable commit (`orchestrator/app/main.py:335`). A crash mid-work means the message is never acked, so RabbitMQ redelivers it on restart.

**One-liner:** "Every hop is write-then-ack, never ack-then-write. A crash anywhere redelivers; it never drops."

### 4b. No double processing (idempotency)

1. **Deterministic operation id** (`libs/drcommon/drcommon/models.py:40-50`): `op_id = "{order_id}:{from}->{to}"`. Identical on every redelivery of the same step - that determinism is the hinge of the whole story.
2. **Durable authority = a Postgres unique constraint** on `operations.op_id` (`idempotency.py:19-50`). `claim_operation()` does `INSERT ... ON CONFLICT DO NOTHING RETURNING`; the loser of the race gets `False` and the caller treats its work as a **no-op**. The claim and the state change commit in the **same transaction** (`orchestrator/app/main.py:375-405`), so they succeed or roll back together.
3. **Idempotent downstream effects.** Payment uses `op_id` as the **Stripe-style `Idempotency-Key`** (`orchestrator/app/main.py:342-350`); the charges table PK on the key means a retried authorization **replays the original outcome, never double-charges** (`payment.py:98-164`). Restaurant/courier dedup on `op_id` in a `dispatches` table, so a courier is **dispatched exactly once** even when the fulfill command is retried (`downstream.py:195-258`).
4. **Exactly-once *effects*, never exactly-once *delivery*.** At-least-once delivery (from the outbox + broker) **plus** idempotent consumers = exactly-once effects. Be precise about this wording - claiming exactly-once delivery is a red flag and they will catch it.

**One-liner:** "Duplicates are normal and expected; the unique constraint on the deterministic op_id collapses every duplicate into a no-op at the database level."

### 4c. Recovery (self-healing)

**Two retry tiers + breaker + DLQ:**

- **Tier 1 - in-process HTTP** (`libs/drcommon/drcommon/http_client.py`): up to `HTTP_MAX_RETRIES=3` retries, **exponential backoff with full jitter** (`backoff_base * 2^(n-1)`, capped at `backoff_max`, then `uniform(0, raw)`), `DOWNSTREAM_TIMEOUT_SECONDS=3.0` per attempt. 5xx/timeout are retried; a **429 backs off** honoring `Retry-After`; a definitive **4xx (e.g. 402 decline) is permanent - not retried, doesn't trip the breaker** (`http_client.py:210-214`).
- **Circuit breaker per downstream** (`http_client.py:59-109`): trips `OPEN` after `CIRCUIT_FAIL_THRESHOLD=5` failures; after `CIRCUIT_OPEN_SECONDS=10` goes `HALF_OPEN` and admits a **single probe**; probe success -> `CLOSED`, probe failure -> `OPEN` again. The single-probe pattern prevents thrash while a downstream is barely recovering.
- **Tier 2 - durable broker retry** (`broker.py:175-178`): if HTTP is exhausted or the breaker is open, the command bounces through `q.order.advance.retry` (fixed `RETRY_QUEUE_TTL_MS=5000` delay via per-queue TTL + DLX back to the work queue), capped at `BROKER_MAX_ATTEMPTS=6`, then parks in the **DLQ** (`orchestrator/app/main.py:461-469`).
- **DLQ auto-drain** (`orchestrator/app/main.py:492-503`): every `DLQ_REPLAY_INTERVAL_SECONDS=15` it checks DLQ depth and, **only if all downstreams report healthy**, replays up to 500 parked orders with `attempt` reset to 1. So recovery is **hands-off**: kill a downstream, orders park; restore it, the DLQ drains itself within ~15s. There's also a manual `POST /admin/replay-dlq`.
- **Rate limits don't fail orders:** a 429 backs off rather than failing the order (flow control != outage).
- **Crash recovery:** manual acks + `ORCH_PREFETCH=64` bound in-flight work; unacked messages redeliver on restart; idempotency makes the redelivery a no-op.

**One-liner:** "Fast in-process retries for blips, slow durable broker retries for outages, a breaker so we stop hammering a dead service, and a self-draining DLQ so recovery needs no human."

---

## 5. The lifecycle state machine

- **8 states** (`libs/drcommon/drcommon/states.py:17-25`): happy path `placed -> confirmed -> preparing -> ready -> out_for_delivery -> delivered`, plus `cancelled` (from `placed`/`confirmed`/`preparing`) and `failed` (terminal, from any active stage).
- **How transitions are enforced (be precise and honest):** the advance command names the `from` state it expects. The orchestrator computes `target = next_happy_state(current)` (the **only** legal forward step) and applies it with an **optimistic concurrency guard**: `UPDATE orders SET state=target WHERE order_id=$1 AND state=current` (`orchestrator/app/main.py:~385`). If the row already moved, 0 rows update and the command is acked as a **stale no-op** (`main.py:280`). So an illegal skip can't be *constructed* by the driver, and a stale/duplicate command is rejected by the from-state guard. The declarative `_ALLOWED` matrix (`states.py:41-50`) is the **spec the tests assert against**; the runtime guard is the from-state compare-and-set, not an `_ALLOWED` lookup. (Own this distinction - if asked "where exactly do you reject an illegal transition," that's the answer.)
- **Which stage calls which downstream** (`STAGE_DOWNSTREAM`, `states.py:56-60`): entering `confirmed` -> **payment** (authorize), entering `preparing` -> **restaurant**, entering `out_for_delivery` -> **courier**. `ready`/`delivered` need no downstream.
- **Ordering subtlety they may probe:** the downstream call happens **before** the transition commits. So the effect (e.g. courier dispatch) lands, then the state is recorded. Crash after the downstream succeeds but before commit -> redelivery re-calls the downstream, which returns its cached `duplicate=true` result, then commits. Safe **because** the downstream is idempotent. (This is the "do the side effect, then durably record it" pattern; the idempotent dedup is what makes it safe.)
- **Transition history** (`transitions` table, `orchestrator/app/main.py:86-95`): every hop stored with `from_state, to_state, cause, attempt, created_at` - audit trail and the dashboard/storefront timeline. `cause` is `advance`, `customer_cancelled`, or the failure reason (e.g. `payment declined: 402`).

---

## 6. Observability

- **Live dashboard** (`services/dashboard_api/app/main.py`): **SSE** `/stream`, pushes every `DASHBOARD_PUSH_INTERVAL_MS=1000`. Each tick aggregates from **authoritative sources**: orchestrator `/stats` (per-state counts from Postgres) + `/downstreams` (breaker/latency/error per client) + each downstream `/control` (down flag, config) + load-gen `/status` + **RabbitMQ management API** for real queue depths. Snapshot also cached in Redis (10s TTL). Shows: funnel, throughput (ingest vs deliver, 5s rolling), in-flight, retry/DLQ depth, per-downstream breaker/latency/error, and a "STUCK/RETRYING" banner.
- **Prometheus + Grafana:** all seven services expose `/metrics` (`libs/drcommon/drcommon/metrics.py`); Prometheus scrapes @5s (`infra/prometheus/prometheus.yml`); Grafana is **provisioned** (datasource + dashboard JSON in `infra/grafana/`) so "Dinner Rush - Pipeline" comes up populated with a red panel if DLQ > 0. Key metrics: `orchestrator_transitions_total`, `orchestrator_advance_total{result}`, `orchestrator_broker_retries_total`, `orchestrator_dlq_total`, `orchestrator_inflight`, `downstream_requests_total{result}`, `payment_charged_total`/`payment_declined_total`.
- **Structured logs + correlation id** (`libs/drcommon/drcommon/logging.py`): every log line is JSON; the `order_id` is carried in a `ContextVar` and an `x-correlation-id` header is propagated across HTTP, so one order is traceable end to end.
- **Health:** every service `/health`; orchestrator adds `/stats` and `/downstreams`.

---

## 7. Load generation + downstream simulation (the demo controls)

- **load-gen** (`services/load_gen/app/main.py`): `POST /rush` (-> `LOADGEN_RUSH_RPS=80`), `/baseline` (-> `LOADGEN_BASELINE_RPS=3`), `/stop`, `/control?rps=N`. Smooth ramp over `LOADGEN_RUSH_RAMP_SECONDS=5` via a 0.1s tick with fractional-carry dispatch; in-flight capped by a semaphore (`LOADGEN_MAX_INFLIGHT=400`) so a slow ingestion backs it up instead of exploding memory. Realistic payloads (6 restaurants, 10 menu items, 500 customers). `LOADGEN_DUP_RATE` re-sends prior idempotency keys to exercise dedup. Autostarts a baseline drip.
- **Downstream sim** (`libs/drcommon/drcommon/downstream.py`, `payment.py`): tunable per service - `*_BASE_LATENCY_MS` + `*_JITTER_MS`, `*_FAILURE_RATE` (500s), `*_TIMEOUT_RATE` (504 after a sleep, to exercise the caller timeout), `*_RATE_LIMIT_RPS` (429 above threshold, per 1s window), and **autonomous outage windows** (`*_OUTAGE_PROB` per 5s check -> down for `*_OUTAGE_SECONDS`). Payment adds `*_DECLINE_RATE=0.07` (402, terminal). `/control` (POST), `/control/down`, `/control/up` force-degrade or kill on demand.

---

## 8. Live demo run-of-show

Have the ops dashboard (:8080) up. The control panel is top-right; equivalent curls below each.

1. **Pipeline running.** Point at the funnel moving and the throughput chart. "Baseline drip is 3/sec; every order is payment-authorized before it's confirmed." Open the **storefront** (:8090), place a real order, watch it crawl the funnel on its own tracker.
2. **Dinner rush.** Click **Trigger Dinner Rush** (-> 80/sec) or `curl -X POST localhost:8006/rush`. "In-flight and the advance backlog climb, then drain. Ingestion accepts-and-enqueues and never blocks on a downstream, so the broker absorbs the spike." Flex with `curl -X POST "localhost:8006/control?rps=200"`.
3. **Break something (the money shot).** Click **Break Restaurant** (or Payment/Courier), or `curl -X POST localhost:8003/control/down`. "Breaker trips **OPEN**, retry queue fills, STUCK banner appears - but **DLQ stays 0 and nothing is lost**." Then **Restore** (`/control/up`): "breaker closes, parked work auto-resumes." Bonus: `docker compose kill orchestrator` mid-rush -> it restarts (`restart: unless-stopped`), unacked messages redeliver, it resumes exactly where it left off.
4. **Prove correctness live.** `./scripts/check.sh` -> PASS/FAIL for no-lost (ingestion count == orchestrator count), no-double-charge (charges == distinct idempotency keys), no-double-dispatch (each downstream dispatched once). Run it **after** the chaos to show it still holds.
5. **Health throughout.** Grafana "Dinner Rush - Pipeline"; RabbitMQ mgmt to show the real queues and DLQ.

**Creative touches to name:** the stateless customer storefront over the same APIs; the self-draining health-gated DLQ; the duplicate-injection load knob that lets you *prove* idempotency on demand; payment modeled as real-shaped declines vs technical errors.

---

## 9. Trade-offs and "what I'd do differently with more time"

Volunteering these unprompted is the strongest move. Each is a real, owned limitation:

- **429 can nudge the breaker (known gap).** The docstring says rate-limiting shouldn't trip the breaker, and within a call a 429 backs off correctly. But all transient-exhaustion paths fall through to one shared `breaker.record_failure()` (`http_client.py:226-228`), so a call that exhausts every retry still seeing 429 records one breaker failure. Sustained throttling could therefore contribute to opening the breaker, against the stated intent. **One-line fix:** skip `record_failure()` when the last status was 429. (Owning this shows you read your own concurrency code critically.)
- **Broker retry is fixed-delay, not exponential.** Per-queue TTL is one value, and RabbitMQ per-message TTL has head-of-line-blocking issues, so the exponential character lives in the HTTP tier and the broker tier is a flat 5s. With more time: per-attempt delay queues (5s/15s/45s) or the delayed-message plugin.
- **Single relay / single orchestrator instance shown.** The design supports horizontal scaling (`FOR UPDATE SKIP LOCKED`, per-message acks, idempotent effects), but I demo one instance. I'd run N orchestrators and a chaos test asserting zero-lost/zero-double across them.
- **Outbox is polled, not pushed.** A poll loop adds a little publish latency under extreme load. `LISTEN/NOTIFY` or logical replication would cut it.
- **No distributed tracing UI.** The correlation id is threaded through logs but I didn't wire OpenTelemetry/Jaeger. Logs-by-order-id is the poor-man's version.
- **DLQ inspection is a single replay button**, not a browse-and-selectively-replay UI.
- **State validation is by-construction, not a runtime `can_transition` gate.** Safe for the happy-path driver + from-state CAS, but a belt-and-braces explicit check at the transition site would be more defensive against a future second writer.
- **Two frontend stacks.** Pragmatic reuse, but greenfield I'd standardize on one.

---

## 10. Rapid-fire Q&A bank (anticipated probes)

**Q: Walk me through exactly what happens when the orchestrator crashes mid-order.**
A: The advance message was never acked (we only ack after the transaction commits, `main.py:335`). RabbitMQ holds it and redelivers on restart. The DB transaction either committed (so on redelivery `claim_operation` returns False and we skip - a no-op) or rolled back (so we redo the work cleanly). No lost work, no double effect.

**Q: A downstream succeeds but you crash before recording it. Double dispatch?**
A: No. On redelivery we call the downstream again with the same `op_id`; it finds the prior row in its `dispatches`/`charges` table and returns `duplicate=true` with the original result, then we commit the transition. Effect applied exactly once.

**Q: Two couriers for one order - how is that impossible?**
A: The fulfill `op_id` is deterministic (`order_id:ready->out_for_delivery`). The courier's `dispatches` table has `op_id` as PK with `ON CONFLICT DO NOTHING`. The second call can't insert, so it dispatches zero couriers and returns the cached result.

**Q: Charge twice?**
A: Payment keys the `charges` table on the `Idempotency-Key` (= our `op_id`). A retried authorization replays the recorded outcome. Concurrent same-key calls race on the PK; exactly one wins, the other returns the winner's record.

**Q: You said exactly-once. Defend that.**
A: I say exactly-once **effects**, not delivery. Delivery is at-least-once (outbox + broker can both duplicate). Idempotent consumers on a deterministic key turn at-least-once delivery into exactly-once effects. Claiming exactly-once delivery would be wrong.

**Q: Redis dies mid-rush. What breaks?**
A: Nothing correctness-wise. The first-line dedup returns False (fail-open) and rate-limit returns True; Postgres still enforces no-double via the unique constraint. We just do a few more DB round-trips until Redis is back. That's the deliberate reason Redis is never the authority.

**Q: Why is the failed count ~7% but breakers stay closed and DLQ is 0?**
A: Those are card **declines** (402), a legitimate business outcome from a healthy provider, not an outage. Declines are terminal and intentionally not retried (retrying a decline can't change the answer and risks a double charge). They don't trip the breaker or hit the DLQ - those are reserved for technical failures. `PAYMENT_DECLINE_RATE` defaults to 0.07; set it to 0 to see failures vanish.

**Q: How do you stop the retry tier from hammering a dead downstream forever?**
A: The breaker. After 5 failures it opens and we stop calling for 10s; commands take the broker-retry path instead, capped at 6 attempts, then park in the DLQ. The DLQ only auto-drains once health checks pass, so we don't replay into a still-dead service.

**Q: What orders the boot so services don't crash-loop on a missing broker?**
A: `depends_on` with healthchecks in compose; migrations run on startup; consumers reconnect. A service coming up before its broker just retries the connection.

**Q: How would you scale the orchestrator?**
A: Run N instances. Acks are per-message so work distributes; the outbox relay uses `FOR UPDATE SKIP LOCKED` so relays claim disjoint batches; effects are idempotent so a duplicate across instances is a no-op. The from-state CAS prevents two instances applying the same transition.

**Q: Biggest weakness?**
A: (Pick one from section 9 and own it - the 429/breaker gap or the fixed-delay broker retry are the most concrete and show self-awareness.)

---

## 11. Numbers cheat sheet (env vars + defaults)

| Knob | Default | What |
|------|---------|------|
| `HTTP_MAX_RETRIES` | 3 | in-process retries (4 attempts total) |
| `HTTP_BACKOFF_BASE_SECONDS` / `_MAX_` | 0.2 / 2.0 | exp backoff + full jitter |
| `DOWNSTREAM_TIMEOUT_SECONDS` | 3.0 | per-attempt HTTP timeout |
| `CIRCUIT_FAIL_THRESHOLD` | 5 | failures to open breaker |
| `CIRCUIT_OPEN_SECONDS` | 10 | cooldown before half-open probe |
| `BROKER_MAX_ATTEMPTS` | 6 | broker retry bounces before DLQ |
| `RETRY_QUEUE_TTL_MS` | 5000 | fixed broker-retry delay |
| `ORCH_PREFETCH` | 64 | max unacked in-flight |
| `DLQ_REPLAY_INTERVAL_SECONDS` | 15 | auto-drain tick |
| `LOADGEN_BASELINE_RPS` / `RUSH_RPS` | 3 / 80 | drip vs rush |
| `LOADGEN_RUSH_RAMP_SECONDS` | 5 | ramp time |
| `LOADGEN_DUP_RATE` | 0.0 | duplicate injection (exercise dedup) |
| `PAYMENT_DECLINE_RATE` | 0.07 | card declines (402, terminal) |
| `*_FAILURE_RATE` | 0.10-0.12 | downstream 500 rate |
| `*_TIMEOUT_RATE` | 0.02-0.04 | downstream 504 rate |
| `*_RATE_LIMIT_RPS` | 25-50 | 429 threshold |
| `*_OUTAGE_PROB` / `_SECONDS` | 0.0 / 20 | autonomous fall-over windows |
| `CANCEL_RATE` | 0.0 | populate the cancelled path |

---

## 12. The 30-second close (if they ask "anything else?")

"The thing I'm most proud of is that recovery is **hands-off**: you can kill any
downstream or the orchestrator itself mid-rush, and the system parks work safely,
keeps the dashboard live, and drains itself back to healthy with no human action -
and the correctness checker proves nothing was lost or double-processed. The
thing I'd do next is harden horizontal scaling with a chaos test across multiple
orchestrators, and fix the one breaker/429 edge I mentioned. I optimized for the
failure story because that's what this domain actually lives and dies on."
