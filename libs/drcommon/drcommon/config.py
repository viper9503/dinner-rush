"""Environment-driven configuration helpers.

Every tunable in this system comes from an environment variable so the whole
platform can be reconfigured from docker-compose.yml without code changes.
"""
from __future__ import annotations

import os


def env_str(key: str, default: str) -> str:
    return os.getenv(key, default)


def env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    return int(raw) if raw not in (None, "") else default


def env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    return float(raw) if raw not in (None, "") else default


def env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw in (None, ""):
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def service_name() -> str:
    return os.getenv("SERVICE_NAME", "unknown-service")


def postgres_dsn(dbname: str) -> str:
    user = env_str("POSTGRES_USER", "dinner")
    password = env_str("POSTGRES_PASSWORD", "dinner")
    host = env_str("POSTGRES_HOST", "postgres")
    port = env_int("POSTGRES_PORT", 5432)
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


def rabbitmq_url() -> str:
    user = env_str("RABBITMQ_USER", "dinner")
    password = env_str("RABBITMQ_PASSWORD", "dinner")
    host = env_str("RABBITMQ_HOST", "rabbitmq")
    port = env_int("RABBITMQ_PORT", 5672)
    return f"amqp://{user}:{password}@{host}:{port}/"


def redis_url() -> str:
    host = env_str("REDIS_HOST", "redis")
    port = env_int("REDIS_PORT", 6379)
    return f"redis://{host}:{port}/0"
