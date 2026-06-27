"""dashboard-api - live read model and backend-for-frontend.

Builds a single snapshot of the whole pipeline and pushes it to the browser over
SSE with no manual refresh. Counts come from the orchestrator's authoritative
per-state numbers (so the dashboard self-heals after a restart and can never
drift), while the broker event stream drives sub-second throughput windows.
Queue depths come from the RabbitMQ management API and downstream health from the
orchestrator's circuit breakers, so the "stuck or failing" picture is real.

It is also the only origin the web app talks to: control actions (trigger the
rush, break a downstream, replay the DLQ) are proxied from here.
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import deque
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from aio_pika.abc import AbstractIncomingMessage
from starlette.responses import JSONResponse, StreamingResponse

from drcommon import (
    Broker,
    Envelope,
    create_app,
    env_int,
    env_str,
    get_logger,
    rabbitmq_url,
    redis_url,
)

log = get_logger("dashboard-api")

PUSH_MS = env_int("DASHBOARD_PUSH_INTERVAL_MS", 1000)
PUSH_SECONDS = PUSH_MS / 1000.0
WINDOW = 5.0  # throughput averaging window (seconds)

ORCH_URL = env_str("ORCHESTRATOR_URL", "http://orchestrator:8002")
PAYMENT_URL = env_str("PAYMENT_URL", "http://payment:8007")
RESTAURANT_URL = env_str("RESTAURANT_URL", "http://restaurant:8003")
COURIER_URL = env_str("COURIER_URL", "http://courier:8004")
LOADGEN_URL = env_str("LOADGEN_URL", "http://load-gen:8006")
MGMT_URL = env_str("RABBITMQ_MGMT_URL", "http://rabbitmq:15672")
MGMT_USER = env_str("RABBITMQ_USER", "dinner")
MGMT_PASS = env_str("RABBITMQ_PASSWORD", "dinner")

STATES = ["placed", "confirmed", "preparing", "ready", "out_for_delivery",
          "delivered", "cancelled", "failed"]
NON_TERMINAL = {"placed", "confirmed", "preparing", "ready", "out_for_delivery"}


def _empty_snapshot() -> dict:
    return {
        "ts": None,
        "states": {s: 0 for s in STATES},
        "totals": {"ingested": 0, "delivered": 0, "failed": 0, "cancelled": 0, "in_flight": 0},
        "throughput": {"ingest_per_sec": 0.0, "deliver_per_sec": 0.0},
        "retries": {"broker_retries": 0, "dlq_depth": 0},
        "queues": {"advance": 0, "retry": 0, "dlq": 0},
        "downstreams": {
            "payment": {"breaker": "unknown", "error_rate": 0.0, "avg_latency_ms": 0, "down": False},
            "restaurant": {"breaker": "unknown", "error_rate": 0.0, "avg_latency_ms": 0, "down": False},
            "courier": {"breaker": "unknown", "error_rate": 0.0, "avg_latency_ms": 0, "down": False},
        },
        "load": {"mode": "unknown", "target_rps": 0.0, "sent": 0},
        "orchestrator_up": False,
    }


class Dashboard:
    def __init__(self) -> None:
        self.broker = Broker(rabbitmq_url())
        self.snapshot = _empty_snapshot()
        self.ingest_times: deque[float] = deque()
        self.deliver_times: deque[float] = deque()
        self.http: httpx.AsyncClient | None = None
        self.redis: aioredis.Redis | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self.http = httpx.AsyncClient(timeout=2.0)
        self.redis = aioredis.from_url(redis_url(), decode_responses=True)
        await self.broker.connect()
        await self.broker.declare_topology()
        # Ephemeral, bounded live-tail queue: no backlog while we are away.
        events_q = await self.broker.declare_event_queue(
            "q.dashboard.events", ["order.#"],
            durable=False, auto_delete=True,
            arguments={"x-message-ttl": 30000, "x-max-length": 100000},
        )
        await self.broker.consume(events_q, self.on_event)
        self._task = asyncio.create_task(self._refresh_loop(), name="dash-refresh")
        log.info("dashboard-api ready")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
        await self.broker.close()
        if self.http:
            await self.http.aclose()
        if self.redis:
            await self.redis.aclose()

    async def on_event(self, message: AbstractIncomingMessage) -> None:
        try:
            env = Envelope.from_bytes(message.body)
            now = time.monotonic()
            if env.type == "order.placed":
                self.ingest_times.append(now)
            elif env.type == "order.transition" and env.data.get("to") == "delivered":
                self.deliver_times.append(now)
        except Exception:  # noqa: BLE001 - a live view must never choke on a bad event
            pass
        finally:
            await message.ack()

    def _rate(self, times: deque[float], now: float) -> float:
        while times and now - times[0] > WINDOW:
            times.popleft()
        return round(len(times) / WINDOW, 2)

    async def _queue_depth(self, name: str) -> int:
        assert self.http is not None
        url = f"{MGMT_URL}/api/queues/%2F/{name}"
        r = await self.http.get(url, auth=(MGMT_USER, MGMT_PASS))
        r.raise_for_status()
        return int(r.json().get("messages", 0))

    async def _get_json(self, url: str) -> dict:
        assert self.http is not None
        r = await self.http.get(url)
        r.raise_for_status()
        return r.json()

    async def _refresh_loop(self) -> None:
        while True:
            try:
                await self._refresh_once()
            except Exception as exc:  # noqa: BLE001 - keep pushing even if a source is down
                log.warning("refresh error: %s", exc)
            await asyncio.sleep(PUSH_SECONDS)

    async def _refresh_once(self) -> None:
        now = time.monotonic()
        snap = _empty_snapshot()
        snap["ts"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        snap["throughput"]["ingest_per_sec"] = self._rate(self.ingest_times, now)
        snap["throughput"]["deliver_per_sec"] = self._rate(self.deliver_times, now)

        results = await asyncio.gather(
            self._safe(self._get_json(f"{ORCH_URL}/stats")),
            self._safe(self._get_json(f"{ORCH_URL}/downstreams")),
            self._safe(self._get_json(f"{PAYMENT_URL}/control")),
            self._safe(self._get_json(f"{RESTAURANT_URL}/control")),
            self._safe(self._get_json(f"{COURIER_URL}/control")),
            self._safe(self._get_json(f"{LOADGEN_URL}/status")),
            self._safe(self._queue_depth("q.order.advance")),
            self._safe(self._queue_depth("q.order.advance.retry")),
            self._safe(self._queue_depth("q.order.dlq")),
        )
        stats, down_health, pay_ctl, rest_ctl, cour_ctl, load, q_adv, q_retry, q_dlq = results

        if isinstance(stats, dict):
            snap["orchestrator_up"] = True
            for s in STATES:
                snap["states"][s] = int(stats.get(s, 0))
            snap["totals"]["delivered"] = snap["states"]["delivered"]
            snap["totals"]["failed"] = snap["states"]["failed"]
            snap["totals"]["cancelled"] = snap["states"]["cancelled"]
            snap["totals"]["in_flight"] = sum(snap["states"][s] for s in NON_TERMINAL)
            snap["totals"]["ingested"] = sum(snap["states"].values())

        if isinstance(down_health, dict):
            for name in ("payment", "restaurant", "courier"):
                h = down_health.get(name, {})
                breaker = (h.get("breaker") or {}).get("state", "unknown")
                snap["downstreams"][name]["breaker"] = breaker
                snap["downstreams"][name]["error_rate"] = h.get("error_rate", 0.0)
                snap["downstreams"][name]["avg_latency_ms"] = h.get("avg_latency_ms", 0)
        if isinstance(pay_ctl, dict):
            snap["downstreams"]["payment"]["down"] = bool(pay_ctl.get("down", False))
        if isinstance(rest_ctl, dict):
            snap["downstreams"]["restaurant"]["down"] = bool(rest_ctl.get("down", False))
        if isinstance(cour_ctl, dict):
            snap["downstreams"]["courier"]["down"] = bool(cour_ctl.get("down", False))

        if isinstance(load, dict):
            snap["load"] = {
                "mode": load.get("mode", "unknown"),
                "target_rps": load.get("target_rps", 0.0),
                "current_rps": load.get("current_rps", 0.0),
                "sent": load.get("sent", 0),
            }

        snap["queues"]["advance"] = q_adv if isinstance(q_adv, int) else 0
        snap["queues"]["retry"] = q_retry if isinstance(q_retry, int) else 0
        snap["queues"]["dlq"] = q_dlq if isinstance(q_dlq, int) else 0
        snap["retries"]["broker_retries"] = snap["queues"]["retry"]
        snap["retries"]["dlq_depth"] = snap["queues"]["dlq"]

        self.snapshot = snap
        if self.redis is not None:
            try:
                await self.redis.set("dashboard:snapshot", json.dumps(snap), ex=10)
            except Exception:  # noqa: BLE001
                pass

    async def _safe(self, coro):
        try:
            return await coro
        except Exception:  # noqa: BLE001
            return None


dash = Dashboard()


@asynccontextmanager
async def lifespan(app):
    await dash.start()
    try:
        yield
    finally:
        await dash.stop()


app = create_app("dashboard-api", lifespan=lifespan, cors=True)


@app.get("/snapshot")
async def snapshot() -> dict:
    return dash.snapshot


@app.get("/stream")
async def stream() -> StreamingResponse:
    async def gen():
        # Prime the stream so the UI paints immediately.
        yield f"data: {json.dumps(dash.snapshot)}\n\n"
        while True:
            await asyncio.sleep(PUSH_SECONDS)
            yield f"data: {json.dumps(dash.snapshot)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ---- control proxy (the web app talks only to dashboard-api) ----

async def _proxy_post(url: str, **kwargs) -> JSONResponse:
    assert dash.http is not None
    try:
        r = await dash.http.post(url, **kwargs)
        return JSONResponse(r.json() if r.content else {"status": r.status_code}, status_code=r.status_code)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": str(exc)}, status_code=502)


@app.post("/control/load/rush")
async def load_rush():
    return await _proxy_post(f"{LOADGEN_URL}/rush")


@app.post("/control/load/baseline")
async def load_baseline():
    return await _proxy_post(f"{LOADGEN_URL}/baseline")


@app.post("/control/load/stop")
async def load_stop():
    return await _proxy_post(f"{LOADGEN_URL}/stop")


@app.post("/control/load/rate")
async def load_rate(rps: float):
    return await _proxy_post(f"{LOADGEN_URL}/control", params={"rps": rps})


@app.post("/control/downstream/{name}/{action}")
async def downstream_control(name: str, action: str):
    base = {"payment": PAYMENT_URL, "restaurant": RESTAURANT_URL, "courier": COURIER_URL}.get(name)
    if base is None or action not in ("up", "down"):
        return JSONResponse({"error": "bad request"}, status_code=400)
    return await _proxy_post(f"{base}/control/{action}")


@app.post("/admin/replay-dlq")
async def replay_dlq(limit: int = 100):
    return await _proxy_post(f"{ORCH_URL}/admin/replay-dlq", params={"limit": limit})
