import type { DownstreamHealth } from "../types";

interface Props {
  title: string;
  health: DownstreamHealth;
}

const BREAKER_LABEL: Record<string, string> = {
  closed: "closed",
  open: "open",
  half_open: "half-open",
  unknown: "unknown",
};

function breakerClass(b: string): string {
  if (b === "closed" || b === "open" || b === "half_open") return b;
  return "unknown";
}

export default function DownstreamCard({ title, health }: Props) {
  const errPct = (health.error_rate * 100).toFixed(1);
  const errClass =
    health.error_rate >= 0.5 ? "crit" : health.error_rate >= 0.1 ? "warn" : "";
  const latClass =
    health.avg_latency_ms >= 2000
      ? "crit"
      : health.avg_latency_ms >= 800
      ? "warn"
      : "";
  const bClass = breakerClass(health.breaker);

  return (
    <div className={`ds-card${health.down ? " is-down" : ""}`}>
      <div className="ds-head">
        <span className="title">{title}</span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {health.down && <span className="down-badge">DOWN</span>}
          <span className={`chip ${bClass}`}>{BREAKER_LABEL[bClass]}</span>
        </span>
      </div>
      <div className="ds-metrics">
        <div className="ds-metric">
          <div className="m-label">Error rate</div>
          <div className={`m-value ${errClass}`}>{errPct}%</div>
        </div>
        <div className="ds-metric">
          <div className="m-label">Avg latency</div>
          <div className={`m-value ${latClass}`}>
            {Math.round(health.avg_latency_ms)} ms
          </div>
        </div>
      </div>
    </div>
  );
}
