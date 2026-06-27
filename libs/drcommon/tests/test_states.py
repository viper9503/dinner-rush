"""Lifecycle state machine and operation-id determinism."""
import pytest

from drcommon.states import (
    HAPPY_PATH,
    STAGE_DOWNSTREAM,
    IllegalTransition,
    State,
    assert_transition,
    can_transition,
    is_terminal,
    next_happy_state,
)
from drcommon.models import op_id_for


def test_happy_path_is_fully_legal():
    for a, b in zip(HAPPY_PATH, HAPPY_PATH[1:]):
        assert can_transition(a, b), f"{a}->{b} should be legal"


def test_cannot_skip_a_stage():
    assert not can_transition(State.CONFIRMED, State.OUT_FOR_DELIVERY)
    assert not can_transition(State.PLACED, State.PREPARING)
    with pytest.raises(IllegalTransition):
        assert_transition(State.PLACED, State.DELIVERED)


def test_cannot_move_backwards():
    assert not can_transition(State.PREPARING, State.CONFIRMED)
    assert not can_transition(State.DELIVERED, State.OUT_FOR_DELIVERY)


def test_terminal_states_have_no_exits():
    for term in (State.DELIVERED, State.CANCELLED, State.FAILED):
        assert is_terminal(term)
        assert next_happy_state(term) is None
        for other in State:
            assert not can_transition(term, other)


def test_failed_reachable_from_every_active_stage():
    for s in (State.PLACED, State.CONFIRMED, State.PREPARING, State.READY, State.OUT_FOR_DELIVERY):
        assert can_transition(s, State.FAILED)


def test_cancelled_only_from_early_stages():
    assert can_transition(State.PLACED, State.CANCELLED)
    assert can_transition(State.CONFIRMED, State.CANCELLED)
    assert can_transition(State.PREPARING, State.CANCELLED)
    assert not can_transition(State.READY, State.CANCELLED)
    assert not can_transition(State.OUT_FOR_DELIVERY, State.CANCELLED)


def test_stage_downstreams():
    assert STAGE_DOWNSTREAM[State.PREPARING] == "restaurant"
    assert STAGE_DOWNSTREAM[State.OUT_FOR_DELIVERY] == "courier"
    # internal stages call no downstream
    assert State.CONFIRMED not in STAGE_DOWNSTREAM
    assert State.READY not in STAGE_DOWNSTREAM


def test_op_id_is_deterministic_and_unique_per_step():
    oid = "11111111-1111-1111-1111-111111111111"
    a = op_id_for(oid, State.CONFIRMED, State.PREPARING)
    b = op_id_for(oid, State.CONFIRMED, State.PREPARING)
    c = op_id_for(oid, State.PREPARING, State.READY)
    assert a == b  # same step -> same id (redelivery dedups)
    assert a != c  # different step -> different id
    assert a == f"{oid}:confirmed->preparing"
