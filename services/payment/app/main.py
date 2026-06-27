"""payment-svc - simulated Stripe-style payment downstream.

Thin wrapper over the shared `drcommon.payment` engine. The orchestrator calls
this to authorize payment before an order is confirmed; the idempotency key
guarantees an order is charged at most once even under retries. Tunables come
from the PAYMENT_* env vars and /control (including PAYMENT_DECLINE_RATE).
"""
from drcommon.payment import create_payment_app

app = create_payment_app(service_name="payment-svc", prefix="PAYMENT", db_name="payment")
