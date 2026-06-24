"""Prometheus metrics helpers.

Each service runs a single uvicorn worker, so the default in-process registry is
correct (no multiprocess collation needed). Services define their own metric
objects; this module just standardizes how /metrics is exposed and re-exports the
metric primitives so service code has one import site.
"""
from __future__ import annotations

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.requests import Request
from starlette.responses import Response

__all__ = ["Counter", "Gauge", "Histogram", "mount_metrics"]


def mount_metrics(app) -> None:
    """Attach a GET /metrics endpoint in Prometheus text format."""

    async def metrics_endpoint(_: Request) -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.add_route("/metrics", metrics_endpoint)
