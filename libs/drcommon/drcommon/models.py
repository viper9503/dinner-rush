"""Wire models shared by every service.

These are the contract. Every message on the broker is an :class:`Envelope`
serialized to JSON; every HTTP fulfillment call carries an ``op_id`` derived by
:func:`op_id_for`. Keeping these in one place is what lets independently
deployed services agree on the shape of the data without sharing a database.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator

from .states import State


# ---- identifiers / time -----------------------------------------------------

def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat()


# ---- message types (routing keys double as event "type") --------------------

EVENT_PLACED = "order.placed"        # a new order entered the system (fact)
EVENT_TRANSITION = "order.transition"  # an order changed state (fact)
CMD_ADVANCE = "order.advance"        # drive an order one step forward (command)


def op_id_for(order_id: str, from_state: State | str, to_state: State | str) -> str:
    """Deterministic operation id for a single lifecycle step.

    Because the id is a pure function of (order, from, to) it is identical on a
    redelivery of the same advance command. That determinism is the hinge of the
    whole idempotency story: the orchestrator's unique constraint on ``op_id``
    and the downstream's own dedup both collapse a duplicate step into a no-op.
    """
    f = from_state.value if isinstance(from_state, State) else from_state
    t = to_state.value if isinstance(to_state, State) else to_state
    return f"{order_id}:{f}->{t}"


# ---- HTTP: ingestion input --------------------------------------------------

class OrderItem(BaseModel):
    name: str
    qty: int = Field(default=1, ge=1)
    price_cents: int = Field(default=0, ge=0)


class OrderRequest(BaseModel):
    """Body of POST /orders on ingestion-svc."""

    customer_id: str
    restaurant_id: str
    items: list[OrderItem]
    # Optional client-supplied idempotency key. If absent, ingestion derives one.
    idempotency_key: str | None = None

    @field_validator("items")
    @classmethod
    def _non_empty(cls, v: list[OrderItem]) -> list[OrderItem]:
        if not v:
            raise ValueError("order must contain at least one item")
        return v

    def total_cents(self) -> int:
        return sum(i.qty * i.price_cents for i in self.items)


# ---- HTTP: fulfillment command to a downstream ------------------------------

class FulfillRequest(BaseModel):
    """Body of POST /fulfill on restaurant-svc / courier-svc."""

    order_id: str
    op_id: str
    stage: str            # the lifecycle state being entered, e.g. "preparing"
    customer_id: str | None = None
    restaurant_id: str | None = None


class FulfillResult(BaseModel):
    op_id: str
    order_id: str
    stage: str
    status: str = "ok"
    # True when this response was served from the downstream's dedup cache,
    # i.e. the effect had already been applied for this op_id.
    duplicate: bool = False
    detail: dict[str, Any] = Field(default_factory=dict)


# ---- broker envelope --------------------------------------------------------

class Envelope(BaseModel):
    """Uniform wrapper for everything published to the broker."""

    event_id: str = Field(default_factory=new_uuid)
    type: str
    order_id: str
    ts: str = Field(default_factory=utcnow_iso)
    # Broker-level redelivery counter (incremented on each retry-queue bounce).
    attempt: int = 1
    data: dict[str, Any] = Field(default_factory=dict)

    def to_bytes(self) -> bytes:
        return self.model_dump_json().encode("utf-8")

    @classmethod
    def from_bytes(cls, raw: bytes) -> "Envelope":
        return cls.model_validate_json(raw)


def make_event(type_: str, order_id: str, **data: Any) -> Envelope:
    return Envelope(type=type_, order_id=order_id, data=data)
