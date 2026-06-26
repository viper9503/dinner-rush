import type { ConnStatus } from "../types";

interface Props {
  conn: ConnStatus;
  orchestratorUp: boolean;
  ts: string | null;
}

function fmtTs(ts: string | null): string {
  if (!ts) return "no data yet";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const CONN_LABEL: Record<ConnStatus, string> = {
  connecting: "connecting",
  live: "live",
  down: "disconnected",
};

export default function Header({ conn, orchestratorUp, ts }: Props) {
  return (
    <header className="header">
      <h1>
        Dinner Rush <span className="accent">— Live Ops</span>
      </h1>

      <span className="pill">
        <span className={`dot ${conn}`} />
        {CONN_LABEL[conn]}
      </span>

      <span className={`pill ${orchestratorUp ? "up" : "bad"}`}>
        <span className={`dot ${orchestratorUp ? "live" : "down"}`} />
        orchestrator {orchestratorUp ? "up" : "down"}
      </span>

      <span className="spacer" />

      <span className="ts">snapshot {fmtTs(ts)}</span>
    </header>
  );
}
