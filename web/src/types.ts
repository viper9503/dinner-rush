export type BreakerState = "closed" | "open" | "half_open" | "unknown";

export interface Snapshot {
  ts: string | null;
  states: {
    placed: number;
    confirmed: number;
    preparing: number;
    ready: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    failed: number;
  };
  totals: {
    ingested: number;
    delivered: number;
    failed: number;
    cancelled: number;
    in_flight: number;
  };
  throughput: {
    ingest_per_sec: number;
    deliver_per_sec: number;
  };
  retries: {
    broker_retries: number;
    dlq_depth: number;
  };
  queues: {
    advance: number;
    retry: number;
    dlq: number;
  };
  downstreams: {
    restaurant: DownstreamHealth;
    courier: DownstreamHealth;
  };
  load: {
    mode: string;
    target_rps: number;
    current_rps?: number;
    sent: number;
  };
  orchestrator_up: boolean;
}

export interface DownstreamHealth {
  breaker: BreakerState | string;
  error_rate: number;
  avg_latency_ms: number;
  down: boolean;
}

/** A single point in the rolling client-side throughput history. */
export interface HistoryPoint {
  t: number; // wall-clock ms when received
  label: string; // short HH:MM:SS label for the x axis
  ingest: number;
  deliver: number;
}

export type ConnStatus = "connecting" | "live" | "down";
