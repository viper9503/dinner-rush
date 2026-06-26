import type { Snapshot } from "../types";

interface Props {
  states: Snapshot["states"];
}

const STAGES: { key: keyof Snapshot["states"]; label: string; color: string }[] = [
  { key: "placed", label: "Placed", color: "#3a9bff" },
  { key: "confirmed", label: "Confirmed", color: "#4ab3ff" },
  { key: "preparing", label: "Preparing", color: "#9b6dff" },
  { key: "ready", label: "Ready", color: "#f5a623" },
  { key: "out_for_delivery", label: "Out for delivery", color: "#2ecc71" },
  { key: "delivered", label: "Delivered", color: "#1fae5a" },
];

export default function Funnel({ states }: Props) {
  const max = Math.max(1, ...STAGES.map((s) => states[s.key]));

  return (
    <div className="panel">
      <h2>Pipeline funnel</h2>
      <div className="funnel">
        {STAGES.map((s) => {
          const v = states[s.key];
          const pct = (v / max) * 100;
          return (
            <div className="funnel-row" key={s.key}>
              <div className="name">{s.label}</div>
              <div className="funnel-bar-track">
                <div
                  className="funnel-bar"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                  }}
                />
              </div>
              <div className="count">{v.toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      <div className="badges">
        <div className="badge cancelled">
          <span className="b-label">Cancelled</span>
          <span className="b-count">{states.cancelled.toLocaleString()}</span>
        </div>
        <div className="badge failed">
          <span className="b-label">Failed</span>
          <span className="b-count">{states.failed.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
