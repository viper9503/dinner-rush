"""Order lifecycle state machine.

The lifecycle is modeled explicitly here rather than as ad-hoc status strings so
that every transition is validated in one place and illegal jumps (for example
going straight from confirmed to out_for_delivery) are rejected and logged.

    placed -> confirmed -> preparing -> ready -> out_for_delivery -> delivered
       \
        -> cancelled   (from placed / confirmed / preparing)
        -> failed      (terminal, reachable from any active fulfillment stage)
"""
from __future__ import annotations

from enum import Enum


class State(str, Enum):
    PLACED = "placed"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    FAILED = "failed"


# The happy-path ordering used to drive the pipeline forward one step at a time.
HAPPY_PATH: list[State] = [
    State.PLACED,
    State.CONFIRMED,
    State.PREPARING,
    State.READY,
    State.OUT_FOR_DELIVERY,
    State.DELIVERED,
]

TERMINAL_STATES: frozenset[State] = frozenset({State.DELIVERED, State.CANCELLED, State.FAILED})

# Allowed transitions. Anything not listed here is illegal and rejected server-side.
_ALLOWED: dict[State, frozenset[State]] = {
    State.PLACED: frozenset({State.CONFIRMED, State.CANCELLED, State.FAILED}),
    State.CONFIRMED: frozenset({State.PREPARING, State.CANCELLED, State.FAILED}),
    State.PREPARING: frozenset({State.READY, State.CANCELLED, State.FAILED}),
    State.READY: frozenset({State.OUT_FOR_DELIVERY, State.FAILED}),
    State.OUT_FOR_DELIVERY: frozenset({State.DELIVERED, State.FAILED}),
    State.DELIVERED: frozenset(),
    State.CANCELLED: frozenset(),
    State.FAILED: frozenset(),
}

# Which downstream a given "enter this state" step depends on. Used by the
# orchestrator to decide whether a transition needs a downstream call.
# Entering "confirmed" authorizes payment (Stripe-style); "preparing" fires the
# restaurant ticket; "out_for_delivery" dispatches the courier.
STAGE_DOWNSTREAM: dict[State, str] = {
    State.CONFIRMED: "payment",
    State.PREPARING: "restaurant",
    State.OUT_FOR_DELIVERY: "courier",
}


class IllegalTransition(Exception):
    def __init__(self, frm: State, to: State) -> None:
        super().__init__(f"illegal transition {frm.value} -> {to.value}")
        self.frm = frm
        self.to = to


def can_transition(frm: State, to: State) -> bool:
    return to in _ALLOWED.get(frm, frozenset())


def assert_transition(frm: State, to: State) -> None:
    if not can_transition(frm, to):
        raise IllegalTransition(frm, to)


def is_terminal(state: State) -> bool:
    return state in TERMINAL_STATES


def next_happy_state(state: State) -> State | None:
    """The next state on the happy path, or None if there is no forward step."""
    try:
        idx = HAPPY_PATH.index(state)
    except ValueError:
        return None
    if idx + 1 < len(HAPPY_PATH):
        return HAPPY_PATH[idx + 1]
    return None
