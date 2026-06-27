"""Circuit breaker behavior and the wire envelope round-trip."""
import time

from drcommon.http_client import BreakerState, CircuitBreaker
from drcommon.models import Envelope, OrderItem, OrderRequest, make_event


def test_breaker_opens_after_threshold():
    cb = CircuitBreaker(fail_threshold=3, open_seconds=10)
    assert cb.allow()
    for _ in range(3):
        cb.record_failure()
    assert cb.state is BreakerState.OPEN
    assert not cb.allow()  # rejects calls while open


def test_breaker_half_open_admits_single_probe():
    cb = CircuitBreaker(fail_threshold=2, open_seconds=0.05)
    cb.record_failure()
    cb.record_failure()
    assert cb.state is BreakerState.OPEN
    time.sleep(0.06)
    # First caller after cooldown is admitted as the half-open probe...
    assert cb.allow()
    assert cb.state is BreakerState.HALF_OPEN
    # ...subsequent callers are rejected until the probe resolves.
    assert not cb.allow()


def test_breaker_closes_on_probe_success():
    cb = CircuitBreaker(fail_threshold=2, open_seconds=0.05)
    cb.record_failure()
    cb.record_failure()
    time.sleep(0.06)
    assert cb.allow()  # probe admitted
    cb.record_success()
    assert cb.state is BreakerState.CLOSED
    assert cb.allow()


def test_breaker_reopens_on_probe_failure():
    cb = CircuitBreaker(fail_threshold=2, open_seconds=0.05)
    cb.record_failure()
    cb.record_failure()
    time.sleep(0.06)
    assert cb.allow()  # probe admitted (half-open)
    cb.record_failure()  # probe fails
    assert cb.state is BreakerState.OPEN


def test_envelope_round_trip():
    env = make_event("order.transition", "order-123", **{"from": "placed", "to": "confirmed"})
    raw = env.to_bytes()
    back = Envelope.from_bytes(raw)
    assert back.type == "order.transition"
    assert back.order_id == "order-123"
    assert back.data["from"] == "placed"
    assert back.data["to"] == "confirmed"
    assert back.attempt == 1


def test_order_request_total_and_validation():
    req = OrderRequest(
        customer_id="c1", restaurant_id="r1",
        items=[OrderItem(name="Pizza", qty=2, price_cents=1000),
               OrderItem(name="Soda", qty=1, price_cents=300)],
    )
    assert req.total_cents() == 2300

    import pytest
    with pytest.raises(Exception):
        OrderRequest(customer_id="c1", restaurant_id="r1", items=[])
