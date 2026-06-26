import type { Snapshot } from "../types";

interface Props {
  snap: Snapshot;
}

function num(n: number): string {
  return n.toLocaleString();
}

interface KpiProps {
  label: string;
  value: string;
  unit?: string;
  alert?: boolean;
}

function Kpi({ label, value, unit, alert }: KpiProps) {
  return (
    <div className={`kpi${alert ? " alert" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
    </div>
  );
}

export default function KpiRow({ snap }: Props) {
  const failed = snap.totals.failed;
  const dlq = snap.retries.dlq_depth;

  return (
    <div className="kpis">
      <Kpi
        label="Ingest / sec"
        value={snap.throughput.ingest_per_sec.toFixed(1)}
      />
      <Kpi
        label="Deliver / sec"
        value={snap.throughput.deliver_per_sec.toFixed(1)}
      />
      <Kpi label="In-flight" value={num(snap.totals.in_flight)} />
      <Kpi label="Delivered" value={num(snap.totals.delivered)} />
      <Kpi label="Failed" value={num(failed)} alert={failed > 0} />
      <Kpi label="DLQ depth" value={num(dlq)} alert={dlq > 0} />
    </div>
  );
}
