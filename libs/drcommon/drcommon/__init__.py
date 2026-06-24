"""drcommon - shared infrastructure for the Dinner Rush order pipeline.

One import site for the contract (models, states) and the plumbing every service
reuses (broker, db, outbox, idempotency, resilient http client, app factory).
"""
from __future__ import annotations

from .app import create_app
from .broker import (
    EXCHANGE_DLX,
    EXCHANGE_EVENTS,
    EXCHANGE_RETRY,
    EXCHANGE_WORK,
    Q_ADVANCE,
    Q_ADVANCE_RETRY,
    Q_DLQ,
    RK_ADVANCE,
    RK_PLACED,
    RK_TRANSITION,
    Broker,
)
from .config import (
    env_bool,
    env_float,
    env_int,
    env_str,
    postgres_dsn,
    rabbitmq_url,
    redis_url,
    service_name,
)
from .db import Database
from .http_client import (
    BreakerOpen,
    BreakerState,
    DownstreamError,
    PermanentError,
    ResilientClient,
    TransientExhausted,
)
from .idempotency import (
    OPERATIONS_DDL,
    RedisFirstLine,
    claim_operation,
    operation_exists,
)
from .logging import configure_logging, get_logger, log_fields, set_correlation_id
from .models import (
    CMD_ADVANCE,
    EVENT_PLACED,
    EVENT_TRANSITION,
    Envelope,
    FulfillRequest,
    FulfillResult,
    OrderItem,
    OrderRequest,
    make_event,
    new_uuid,
    op_id_for,
    utcnow_iso,
)
from .outbox import OUTBOX_DDL, OutboxRelay, enqueue
from .states import (
    HAPPY_PATH,
    STAGE_DOWNSTREAM,
    IllegalTransition,
    State,
    assert_transition,
    can_transition,
    is_terminal,
    next_happy_state,
)

__all__ = [
    "create_app",
    "Broker",
    "EXCHANGE_EVENTS", "EXCHANGE_WORK", "EXCHANGE_RETRY", "EXCHANGE_DLX",
    "Q_ADVANCE", "Q_ADVANCE_RETRY", "Q_DLQ",
    "RK_ADVANCE", "RK_PLACED", "RK_TRANSITION",
    "env_str", "env_int", "env_float", "env_bool",
    "postgres_dsn", "rabbitmq_url", "redis_url", "service_name",
    "Database",
    "ResilientClient", "BreakerOpen", "BreakerState",
    "DownstreamError", "PermanentError", "TransientExhausted",
    "OPERATIONS_DDL", "claim_operation", "operation_exists", "RedisFirstLine",
    "configure_logging", "get_logger", "log_fields", "set_correlation_id",
    "Envelope", "make_event", "OrderRequest", "OrderItem",
    "FulfillRequest", "FulfillResult",
    "EVENT_PLACED", "EVENT_TRANSITION", "CMD_ADVANCE",
    "op_id_for", "new_uuid", "utcnow_iso",
    "OUTBOX_DDL", "OutboxRelay", "enqueue",
    "State", "HAPPY_PATH", "STAGE_DOWNSTREAM", "IllegalTransition",
    "assert_transition", "can_transition", "is_terminal", "next_happy_state",
]
