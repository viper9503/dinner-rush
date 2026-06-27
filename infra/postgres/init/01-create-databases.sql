-- Each service owns its own database in this single Postgres instance; no two
-- services share a table. These run once, on first container init. Each service
-- then creates its own tables idempotently on startup.
CREATE DATABASE ingestion;
CREATE DATABASE orchestrator;
CREATE DATABASE restaurant;
CREATE DATABASE courier;
