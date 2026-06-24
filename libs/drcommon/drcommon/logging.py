"""Structured JSON logging with a correlation id threaded across services.

Every log line is a single JSON object. The order id (used as the correlation
id) is carried in a contextvar so it can be attached automatically to every log
emitted while handling a given order, which is what lets a single order be
traced end to end across all services in the log aggregator.
"""
from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar

from .config import service_name

_correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)


def set_correlation_id(value: str | None) -> None:
    _correlation_id.set(value)


def get_correlation_id() -> str | None:
    return _correlation_id.get()


class JsonFormatter(logging.Formatter):
    def __init__(self) -> None:
        super().__init__()
        self._service = service_name()

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%03dZ"),
            "level": record.levelname,
            "service": self._service,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        corr = _correlation_id.get()
        if corr:
            payload["order_id"] = corr
        # Anything passed via logger.info(..., extra={"fields": {...}})
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)
    # Quiet down noisy third-party loggers; we keep our own structured lines.
    for noisy in ("aio_pika", "aiormq", "httpx", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def log_fields(logger: logging.Logger, level: int, msg: str, **fields: object) -> None:
    """Emit a structured line with arbitrary extra fields."""
    logger.log(level, msg, extra={"fields": fields})
