"""Shared flaky-sim core and the payment intent response shapes."""
from drcommon.downstream import FlakyCore, SimConfig
from drcommon.payment import _intent_response


def _cfg(**kw) -> SimConfig:
    base = dict(
        base_latency_ms=0, jitter_ms=0, failure_rate=0.0, timeout_rate=0.0,
        rate_limit_rps=2, outage_prob=0.0, outage_seconds=0,
    )
    base.update(kw)
    return SimConfig(**base)


def test_roll_outcomes_by_rate():
    assert FlakyCore("t", _cfg(failure_rate=1.0)).roll() == "error"
    assert FlakyCore("t", _cfg(timeout_rate=1.0)).roll() == "timeout"
    assert FlakyCore("t", _cfg(decline_rate=1.0)).roll() == "decline"
    assert FlakyCore("t", _cfg()).roll() is None  # all rates zero -> success


def test_forced_down_and_restore():
    core = FlakyCore("t", _cfg(forced_down=True))
    assert core.is_down()
    core.force_up()
    assert not core.is_down()


def test_rate_limiter_trips_above_rps():
    core = FlakyCore("t", _cfg(rate_limit_rps=2))
    assert core.rate_limited() is False  # 1st within budget
    assert core.rate_limited() is False  # 2nd within budget
    assert core.rate_limited() is True   # 3rd exceeds rps=2


def test_payment_intent_response_shapes():
    ok = _intent_response(
        {"payment_intent_id": "pi_x", "amount_cents": 1000, "currency": "usd", "status": "succeeded"},
        duplicate=False,
    )
    assert ok.status_code == 200
    declined = _intent_response(
        {"payment_intent_id": "pi_y", "amount_cents": 1000, "currency": "usd", "status": "declined"},
        duplicate=True,
    )
    assert declined.status_code == 402  # a declined card is a terminal 4xx
