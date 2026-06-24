"""FastAPI application factory shared by every service.

Standardizes the things every service must expose: structured logging, a
``/health`` probe, Prometheus ``/metrics``, and correlation-id propagation so a
single order can be traced across HTTP hops as well as broker hops.
"""
from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .logging import configure_logging, set_correlation_id
from .metrics import mount_metrics

CORRELATION_HEADER = "x-correlation-id"


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        corr = request.headers.get(CORRELATION_HEADER)
        set_correlation_id(corr)
        response = await call_next(request)
        if corr:
            response.headers[CORRELATION_HEADER] = corr
        return response


def create_app(name: str, *, lifespan=None, cors: bool = False) -> FastAPI:
    configure_logging()
    app = FastAPI(title=name, lifespan=lifespan)
    app.add_middleware(CorrelationMiddleware)
    if cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": name}

    mount_metrics(app)
    return app
