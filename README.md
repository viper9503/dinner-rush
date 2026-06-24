# Dinner Rush

An order pipeline for a food-delivery platform that stays correct under bursty load and downstream failure.

Customers place orders; the pipeline drives each order through its lifecycle (placed, confirmed, preparing, ready, out for delivery, delivered) while handing fulfillment to deliberately flaky restaurant and courier systems. A live dashboard shows the pipeline in real time, and a load generator can summon a dinner rush on demand.

One command brings up everything:

```bash
docker compose up --build
```

Full run instructions, demo scripts, architecture, and trade-offs are documented at the bottom of this file once the system is built out. See [CLAUDE.md](CLAUDE.md) for the brief and the locked design decisions.
