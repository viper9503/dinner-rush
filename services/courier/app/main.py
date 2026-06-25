"""courier-svc - simulated flaky courier downstream.

Second instance of the shared `drcommon.downstream` engine, dispatched after the
restaurant stage. Tunables come from the COURIER_* env vars and /control. The
idempotent dedup here is what guarantees a courier is dispatched exactly once per
order even when the orchestrator retries a fulfillment command.
"""
from drcommon.downstream import create_downstream_app

app = create_downstream_app(service_name="courier-svc", prefix="COURIER", db_name="courier")
