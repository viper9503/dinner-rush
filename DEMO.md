# Demo run-of-show

One command to bring it up: `docker compose up --build`. Main view:
**http://localhost:8080**. Grafana: http://localhost:3000. RabbitMQ:
http://localhost:15672 (dinner/dinner).

## 60-second framing (say this first)

"A customer hits Place Order and we drive it placed -> confirmed -> preparing ->
ready -> out_for_delivery -> delivered, while handing fulfillment to flaky
restaurant, courier, and payment systems. It's built as 7 microservices over
RabbitMQ, with Postgres for durable state and a transactional outbox, and Redis
as a fast first-line cache. The design is all about staying correct under burst
and partial failure: no order lost, none processed twice, and it recovers on its
own."

## The four scenarios

1. **Pipeline running** - point at the funnel (orders moving) and throughput
   chart. All three downstream cards green, breakers closed. "Baseline drip is
   3/sec; every order is payment-authorized before it's confirmed."

2. **Dinner rush** - click **Trigger Dinner Rush** (-> 80/sec; or
   `curl -X POST "localhost:8006/control?rps=200"` to flex). "In-flight and the
   advance backlog climb, then drain. Ingestion accepts-and-enqueues and never
   blocks on a downstream, so the broker absorbs the spike."

3. **Break something (the money shot)** - click **Break Courier** (or Payment).
   "Breaker trips OPEN, the retry queue fills, STUCK banner - but DLQ stays 0 and
   nothing is lost." Then **Restore**: "breaker closes, parked work auto-resumes."
   Bonus: `docker compose kill orchestrator` mid-rush -> it restarts and resumes
   exactly where it left off.

4. **Health** - Grafana "Dinner Rush - Pipeline" dashboard; RabbitMQ mgmt to show
   the real queues / DLQ.

5. **Customer's-eye view** (storefront at **http://localhost:8090**) - browse,
   build a multi-restaurant bundle, check out as a guest, land on a live tracker.
   "Same order, two lenses: the ops dashboard sees the whole pipeline, the
   customer sees just theirs." A catering bundle spans several restaurants but a
   pipeline order is single-restaurant, so checkout fans the cart out into one
   order per restaurant (per-restaurant idempotency key) and the tracker
   recomposes them: each kitchen's state shown independently, overall status =
   the least-advanced. The storefront is stateless - it places via ingestion and
   reads via the orchestrator, the same APIs as everything else, so it inherits
   the durability + idempotency guarantees for free. Tie-in: **Break Restaurant**
   while a customer order is in flight, then watch that order stall and recover on
   the customer's own tracker.

## Prove correctness (run live)

```bash
./scripts/check.sh
```
Prints PASS/FAIL for: no lost orders (ingestion == orchestrator), no double
charge (charges == distinct idempotency keys), no double dispatch
(courier/restaurant dispatched once each). Run it after a rush + break/restore to
show it still holds under chaos.

## How the guarantees work (be ready to defend)

- **No lost orders:** order committed before 2xx; state change + outbound event
  written in one transaction (transactional outbox), relayed after commit;
  consumers manual-ack only after durable commit. A crash redelivers.
- **No double processing:** every step has a deterministic op id
  `order_id:from->to`, identical on redelivery. Durable authority = a unique
  constraint on op id in Postgres; a duplicate loses the race and is a no-op.
  Downstreams dedup the same way. Payment uses the op id as a Stripe-style
  `Idempotency-Key`, so a retried auth never charges twice. At-least-once +
  idempotent consumers = exactly-once *effects* (never claim exactly-once
  *delivery*).
- **Recovery:** two retry tiers - in-process exponential backoff + circuit
  breaker per downstream; then a fixed-delay broker retry queue capped by
  BROKER_MAX_ATTEMPTS -> DLQ. The orchestrator auto-drains the DLQ once
  downstreams report healthy, so recovery is hands-off.

## Trade-offs (you will be grilled)

- **Microservices vs monolith:** chose micro because the problem *is* failure
  isolation + independent scaling under burst. Honest caveat: a small team
  shipping for real would often start with a modular monolith and split later.
- **RabbitMQ:** manual acks + dead-letter exchange + TTL retry queues map 1:1
  onto no-lost / no-double / DLQ. Rejected Redis Streams (acks/DLQ more
  hand-rolled) and Kafka (heavier DLQ ergonomics for a single-machine demo).
- **Postgres authority + Redis cache:** Redis can be wiped (which the graders
  induce), so it is never the thing preventing a double effect.
- **Payment as a real-shaped sim:** Stripe-style PaymentIntents + idempotency
  keys, declines (402) are terminal not retried. Simulated so it stays offline,
  single-machine, and breakable on demand.

## Knobs to mention (in .env / compose)

- `LOADGEN_RUSH_RPS` (rush rate), `LOADGEN_BASELINE_RPS` (drip).
- `RESTAURANT_/COURIER_/PAYMENT_OUTAGE_PROB` - set > 0 to make a downstream
  autonomously fall over and recover at random (matches the brief's "fail and
  recover at random" without you touching anything).
- `PAYMENT_DECLINE_RATE` (default 0.07), `CANCEL_RATE` (default 0; > 0 populates
  the cancelled state).
- `BROKER_MAX_ATTEMPTS`, `RETRY_QUEUE_TTL_MS`, `CIRCUIT_*` - resilience tuning.

## What I'd do differently with more time

Horizontal orchestrator scaling (design already supports it via
`FOR UPDATE SKIP LOCKED`); per-message exponential broker backoff; outbox via
LISTEN/NOTIFY instead of polling; distributed tracing (correlation id is already
threaded); automated chaos tests in CI.
