"""load-gen - controllable order traffic generator.

Drives realistic order traffic into ingestion-svc with a control surface so the
operator can run a quiet baseline drip, slam a dinner-rush spike on demand, set
an arbitrary rate, or stop. The dispatcher fires orders in small time slices and
caps in-flight requests with a semaphore, so a slow ingestion path applies
backpressure to the generator instead of exploding memory.
"""
from __future__ import annotations

import asyncio
import random
import time
from contextlib import asynccontextmanager

import httpx

from drcommon import (
    create_app,
    env_bool,
    env_float,
    env_int,
    env_str,
    get_logger,
    new_uuid,
)
from drcommon.metrics import Counter, Gauge

log = get_logger("load-gen")

INGESTION_URL = env_str("INGESTION_URL", "http://ingestion:8001")
BASELINE_RPS = env_float("LOADGEN_BASELINE_RPS", 3.0)
RUSH_RPS = env_float("LOADGEN_RUSH_RPS", 80.0)
RUSH_RAMP_SECONDS = env_float("LOADGEN_RUSH_RAMP_SECONDS", 5.0)
AUTOSTART = env_bool("LOADGEN_AUTOSTART", True)
DUP_RATE = env_float("LOADGEN_DUP_RATE", 0.0)
MAX_INFLIGHT = env_int("LOADGEN_MAX_INFLIGHT", 400)
TICK = 0.1  # dispatch slice

RESTAURANTS = ["pho-90", "bella-napoli", "sakura-sushi", "taco-libre", "curry-house", "burger-barn"]
MENU = [
    ("Margherita Pizza", 1450), ("Pad Thai", 1295), ("Cheeseburger", 1150),
    ("Sushi Combo", 1995), ("Chicken Tikka", 1675), ("Caesar Salad", 950),
    ("Pho Bowl", 1395), ("Fish Tacos", 1250), ("Ramen", 1495), ("Fries", 450),
]
CUSTOMERS = [f"cust-{i:04d}" for i in range(1, 501)]

m_sent = Counter("loadgen_sent_total", "Orders sent", ["result"])
g_target = Gauge("loadgen_target_rps", "Target orders per second")


class Generator:
    def __init__(self) -> None:
        self.target_rps = 0.0
        self.current_rps = 0.0
        self.mode = "stopped"
        self.sent = 0
        self.errors = 0
        self.recent_keys: list[str] = []
        self._client: httpx.AsyncClient | None = None
        self._sem = asyncio.Semaphore(MAX_INFLIGHT)
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._client = httpx.AsyncClient(base_url=INGESTION_URL, timeout=5.0)
        self._task = asyncio.create_task(self._run(), name="loadgen-dispatch")
        if AUTOSTART:
            self.set_baseline()
        log.info("load-gen ready (autostart=%s)", AUTOSTART)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
        if self._client:
            await self._client.aclose()

    def set_baseline(self) -> None:
        self.mode = "baseline"
        self.target_rps = BASELINE_RPS

    def set_rush(self) -> None:
        self.mode = "rush"
        self.target_rps = RUSH_RPS

    def set_rate(self, rps: float) -> None:
        self.mode = "custom"
        self.target_rps = max(0.0, rps)

    def set_stopped(self) -> None:
        self.mode = "stopped"
        self.target_rps = 0.0

    def _make_order(self) -> tuple[dict, str]:
        # Occasionally resend a prior order to exercise idempotent dedup.
        if DUP_RATE > 0 and self.recent_keys and random.random() < DUP_RATE:
            key = random.choice(self.recent_keys)
        else:
            key = new_uuid()
            self.recent_keys.append(key)
            if len(self.recent_keys) > 200:
                self.recent_keys.pop(0)
        n_items = random.randint(1, 4)
        items = [
            {"name": name, "qty": random.randint(1, 3), "price_cents": price}
            for name, price in random.sample(MENU, n_items)
        ]
        order = {
            "customer_id": random.choice(CUSTOMERS),
            "restaurant_id": random.choice(RESTAURANTS),
            "items": items,
            "idempotency_key": key,
        }
        return order, key

    async def _send_one(self) -> None:
        order, _ = self._make_order()
        async with self._sem:
            try:
                resp = await self._client.post("/orders", json=order)
                if resp.status_code < 300:
                    self.sent += 1
                    m_sent.labels(result="ok").inc()
                else:
                    self.errors += 1
                    m_sent.labels(result="rejected").inc()
            except Exception:  # noqa: BLE001 - ingestion may be saturating
                self.errors += 1
                m_sent.labels(result="error").inc()

    async def _run(self) -> None:
        ramp_per_tick = 0.0
        last = time.monotonic()
        carry = 0.0
        while True:
            await asyncio.sleep(TICK)
            now = time.monotonic()
            dt = now - last
            last = now

            # Ramp current_rps toward target so a rush spikes smoothly.
            if RUSH_RAMP_SECONDS > 0:
                ramp_per_tick = (RUSH_RPS / RUSH_RAMP_SECONDS) * dt
            if self.current_rps < self.target_rps:
                self.current_rps = min(self.target_rps, self.current_rps + max(ramp_per_tick, 1.0))
            elif self.current_rps > self.target_rps:
                self.current_rps = self.target_rps
            g_target.set(self.target_rps)

            carry += self.current_rps * dt
            n = int(carry)
            carry -= n
            for _ in range(n):
                asyncio.create_task(self._send_one())

    def status(self) -> dict:
        return {
            "mode": self.mode,
            "target_rps": round(self.target_rps, 2),
            "current_rps": round(self.current_rps, 2),
            "sent": self.sent,
            "errors": self.errors,
        }


gen = Generator()


@asynccontextmanager
async def lifespan(app):
    await gen.start()
    try:
        yield
    finally:
        await gen.stop()


app = create_app("load-gen", lifespan=lifespan, cors=True)


@app.get("/status")
async def status() -> dict:
    return gen.status()


@app.post("/rush")
async def rush() -> dict:
    gen.set_rush()
    log.warning("DINNER RUSH triggered -> %.0f rps", RUSH_RPS)
    return gen.status()


@app.post("/baseline")
async def baseline() -> dict:
    gen.set_baseline()
    return gen.status()


@app.post("/stop")
async def stop() -> dict:
    gen.set_stopped()
    return gen.status()


@app.post("/control")
async def control(rps: float) -> dict:
    gen.set_rate(rps)
    return gen.status()
