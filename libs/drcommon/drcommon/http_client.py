"""Resilient HTTP client for calling the flaky downstreams.

This is the in-process resilience layer that sits in front of each downstream:
per-call timeout, bounded retries with exponential backoff + jitter, and a
circuit breaker so a sustained outage stops hammering a service that is already
down. It deliberately does NOT bury permanent errors or fail the order on
exhaustion: it raises, and the orchestrator decides whether to schedule a
broker-level retry (the slow, durable second tier) or fail the order.

Classification:
* 2xx                      -> success
* 429                      -> rate limited; retry with backoff, does NOT trip the
                              breaker (flow control is expected, not an outage)
* 5xx / timeout / connect  -> transient; retry, counts toward the breaker
* other 4xx                -> permanent; do not retry
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from enum import Enum

import httpx

from .logging import get_logger

log = get_logger("drcommon.http")


class BreakerState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class DownstreamError(Exception):
    """Base for downstream call failures."""


class BreakerOpen(DownstreamError):
    """The circuit is open; the call was not attempted."""


class TransientExhausted(DownstreamError):
    """Retries were exhausted on a transient failure (5xx/timeout/429)."""


class PermanentError(DownstreamError):
    """The downstream returned a definitive non-retryable error (4xx)."""

    def __init__(self, status_code: int, body: str = "") -> None:
        super().__init__(f"permanent downstream error {status_code}")
        self.status_code = status_code
        self.body = body


class CircuitBreaker:
    def __init__(self, fail_threshold: int, open_seconds: float, name: str = "") -> None:
        self.name = name
        self.fail_threshold = fail_threshold
        self.open_seconds = open_seconds
        self.state = BreakerState.CLOSED
        self._failures = 0
        self._opened_at = 0.0
        self._probe_inflight = False

    def allow(self) -> bool:
        if self.state is BreakerState.CLOSED:
            return True
        if self.state is BreakerState.OPEN:
            if (time.monotonic() - self._opened_at) >= self.open_seconds:
                self.state = BreakerState.HALF_OPEN
                self._probe_inflight = False
            else:
                return False
        # HALF_OPEN: admit a single probe, reject the rest.
        if self.state is BreakerState.HALF_OPEN:
            if self._probe_inflight:
                return False
            self._probe_inflight = True
            return True
        return True

    def record_success(self) -> None:
        self._failures = 0
        self._probe_inflight = False
        if self.state is not BreakerState.CLOSED:
            log.info("circuit %s -> closed", self.name)
        self.state = BreakerState.CLOSED

    def record_failure(self) -> None:
        if self.state is BreakerState.HALF_OPEN:
            self._trip()
            return
        self._failures += 1
        if self._failures >= self.fail_threshold:
            self._trip()

    def _trip(self) -> None:
        if self.state is not BreakerState.OPEN:
            log.warning("circuit %s -> open", self.name)
        self.state = BreakerState.OPEN
        self._opened_at = time.monotonic()
        self._probe_inflight = False

    def snapshot(self) -> dict:
        return {"state": self.state.value, "failures": self._failures}


@dataclass
class CallStats:
    calls: int = 0
    successes: int = 0
    failures: int = 0
    rate_limited: int = 0
    retries: int = 0
    last_latency_ms: float = 0.0
    ewma_latency_ms: float = 0.0

    def observe_latency(self, ms: float) -> None:
        self.last_latency_ms = ms
        # Exponentially weighted moving average for a stable dashboard number.
        self.ewma_latency_ms = ms if self.ewma_latency_ms == 0 else 0.2 * ms + 0.8 * self.ewma_latency_ms

    def as_dict(self) -> dict:
        err_rate = (self.failures / self.calls) if self.calls else 0.0
        return {
            "calls": self.calls,
            "successes": self.successes,
            "failures": self.failures,
            "rate_limited": self.rate_limited,
            "retries": self.retries,
            "error_rate": round(err_rate, 4),
            "last_latency_ms": round(self.last_latency_ms, 1),
            "avg_latency_ms": round(self.ewma_latency_ms, 1),
        }


@dataclass
class ResilientClient:
    base_url: str
    name: str
    timeout: float = 3.0
    max_retries: int = 3
    backoff_base: float = 0.2
    backoff_max: float = 2.0
    fail_threshold: int = 5
    open_seconds: float = 10.0
    breaker: CircuitBreaker = field(init=False)
    stats: CallStats = field(init=False, default_factory=CallStats)
    _client: httpx.AsyncClient = field(init=False)

    def __post_init__(self) -> None:
        self.breaker = CircuitBreaker(self.fail_threshold, self.open_seconds, name=self.name)
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    def _backoff(self, attempt: int) -> float:
        # attempt is 1-based; exponential growth capped, with full jitter.
        raw = min(self.backoff_max, self.backoff_base * (2 ** (attempt - 1)))
        return random.uniform(0, raw)

    async def post_json(self, path: str, payload: dict) -> dict:
        """POST JSON with retries + breaker. Returns parsed JSON on 2xx.

        Raises BreakerOpen / TransientExhausted / PermanentError otherwise.
        """
        if not self.breaker.allow():
            raise BreakerOpen(f"{self.name} circuit open")

        self.stats.calls += 1
        last_exc: Exception | None = None
        attempts = self.max_retries + 1
        for attempt in range(1, attempts + 1):
            started = time.monotonic()
            try:
                resp = await self._client.post(path, json=payload)
                latency_ms = (time.monotonic() - started) * 1000
                self.stats.observe_latency(latency_ms)

                if resp.status_code < 300:
                    self.stats.successes += 1
                    self.breaker.record_success()
                    return resp.json()

                if resp.status_code == 429:
                    self.stats.rate_limited += 1
                    last_exc = TransientExhausted("rate limited (429)")
                    # Honor Retry-After if the downstream offered one.
                    delay = _retry_after(resp) or self._backoff(attempt)
                    if attempt < attempts:
                        self.stats.retries += 1
                        await asyncio.sleep(delay)
                        continue
                    break  # exhausted; do NOT trip breaker for pure rate limiting

                if resp.status_code >= 500:
                    last_exc = TransientExhausted(f"downstream {resp.status_code}")
                    if attempt < attempts:
                        self.stats.retries += 1
                        await asyncio.sleep(self._backoff(attempt))
                        continue
                    break

                # Other 4xx: definitive, do not retry.
                self.stats.failures += 1
                self.breaker.record_failure()
                raise PermanentError(resp.status_code, resp.text[:500])

            except (httpx.TimeoutException, httpx.TransportError) as exc:
                latency_ms = (time.monotonic() - started) * 1000
                self.stats.observe_latency(latency_ms)
                last_exc = exc
                if attempt < attempts:
                    self.stats.retries += 1
                    await asyncio.sleep(self._backoff(attempt))
                    continue
                break

        # Exhausted transient failures: count one breaker failure for the call.
        self.stats.failures += 1
        self.breaker.record_failure()
        raise TransientExhausted(str(last_exc) if last_exc else "exhausted")

    def health(self) -> dict:
        return {"breaker": self.breaker.snapshot(), **self.stats.as_dict()}


def _retry_after(resp: httpx.Response) -> float | None:
    raw = resp.headers.get("retry-after")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None
