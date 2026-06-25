"""restaurant-svc - simulated flaky restaurant downstream.

All behavior (latency, failure, rate limiting, outages, idempotent dedup) lives
in the shared `drcommon.downstream` engine; this is just the restaurant-flavored
instance of it. Tunables come from the RESTAURANT_* env vars and can be changed
at runtime via /control for the live failure demo.
"""
from drcommon.downstream import create_downstream_app

app = create_downstream_app(service_name="restaurant-svc", prefix="RESTAURANT", db_name="restaurant")
