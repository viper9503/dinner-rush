"""Resilient HTTP client classification and the Redis first-line semantics."""
import asyncio

import httpx

from drcommon.http_client import BreakerState, ResilientClient, TransientExhausted
from drcommon.idempotency import RedisFirstLine


def _client(handler) -> ResilientClient:
    rc = ResilientClient(
        base_url="http://downstream", name="t",
        timeout=1, max_retries=2, backoff_base=0.0, backoff_max=0.0,
        fail_threshold=2, open_seconds=10,
    )
    # Swap in a mock transport so no real network is touched.
    rc._client = httpx.AsyncClient(base_url="http://downstream", transport=httpx.MockTransport(handler))
    return rc


def test_429_retries_then_succeeds_without_tripping_breaker():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        if calls["n"] < 2:
            return httpx.Response(429, headers={"retry-after": "0"})
        return httpx.Response(200, json={"ok": True})

    rc = _client(handler)
    res = asyncio.run(rc.post_json("/fulfill", {}))
    assert res == {"ok": True}
    # Rate limiting is flow control, not an outage: it must not open the breaker.
    assert rc.breaker.state is BreakerState.CLOSED
    assert rc.stats.rate_limited >= 1
    asyncio.run(rc.aclose())


def test_5xx_exhausts_and_trips_breaker():
    def handler(req):
        return httpx.Response(503)

    rc = _client(handler)
    for _ in range(2):  # two failed calls, breaker threshold is 2
        try:
            asyncio.run(rc.post_json("/fulfill", {}))
        except TransientExhausted:
            pass
    assert rc.breaker.state is BreakerState.OPEN
    asyncio.run(rc.aclose())


def test_open_breaker_short_circuits_without_calling():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        return httpx.Response(503)

    rc = _client(handler)
    for _ in range(2):
        try:
            asyncio.run(rc.post_json("/fulfill", {}))
        except TransientExhausted:
            pass
    assert rc.breaker.state is BreakerState.OPEN
    before = calls["n"]
    # With the breaker open, the next call must not hit the transport at all.
    from drcommon.http_client import BreakerOpen
    try:
        asyncio.run(rc.post_json("/fulfill", {}))
        assert False, "expected BreakerOpen"
    except BreakerOpen:
        pass
    assert calls["n"] == before
    asyncio.run(rc.aclose())


def test_4xx_is_permanent_and_does_not_trip_breaker():
    from drcommon.http_client import PermanentError

    def handler(req):
        return httpx.Response(402, json={"error": {"code": "card_declined"}})

    rc = _client(handler)
    for _ in range(5):  # well past the fail_threshold of 2
        try:
            asyncio.run(rc.post_json("/v1/payment_intents", {}))
            assert False, "expected PermanentError"
        except PermanentError:
            pass
    # A declined card is a healthy 4xx; the breaker must stay closed.
    assert rc.breaker.state is BreakerState.CLOSED
    asyncio.run(rc.aclose())


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, k):
        return self.store.get(k)

    async def set(self, k, v, nx=False, ex=None):
        if nx and k in self.store:
            return None
        self.store[k] = v
        return True


def test_redis_first_line_done_only_after_mark():
    fl = RedisFirstLine(_FakeRedis())
    # is_done is read-only: it must not record anything itself.
    assert asyncio.run(fl.is_done("op1")) is False
    assert asyncio.run(fl.is_done("op1")) is False
    # Only after the effect is committed do we mark it done.
    asyncio.run(fl.mark_done("op1"))
    assert asyncio.run(fl.is_done("op1")) is True
