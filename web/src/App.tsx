import { useEffect, useRef, useState, useCallback } from "react";
import type { Snapshot, HistoryPoint, ConnStatus } from "./types";
import { fetchSnapshot, openStream } from "./api";
import Header from "./components/Header";
import KpiRow from "./components/KpiRow";
import Funnel from "./components/Funnel";
import ThroughputChart from "./components/ThroughputChart";
import Downstreams from "./components/Downstreams";
import Queues from "./components/Queues";
import Controls from "./components/Controls";

const HISTORY_LEN = 60;
// If no snapshot arrives within this window we consider the stream stale.
const STALE_MS = 4000;

const EMPTY_SNAPSHOT: Snapshot = {
  ts: null,
  states: {
    placed: 0,
    confirmed: 0,
    preparing: 0,
    ready: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
    failed: 0,
  },
  totals: { ingested: 0, delivered: 0, failed: 0, cancelled: 0, in_flight: 0 },
  throughput: { ingest_per_sec: 0, deliver_per_sec: 0 },
  retries: { broker_retries: 0, dlq_depth: 0 },
  queues: { advance: 0, retry: 0, dlq: 0 },
  downstreams: {
    payment: { breaker: "unknown", error_rate: 0, avg_latency_ms: 0, down: false },
    restaurant: { breaker: "unknown", error_rate: 0, avg_latency_ms: 0, down: false },
    courier: { breaker: "unknown", error_rate: 0, avg_latency_ms: 0, down: false },
  },
  load: { mode: "unknown", target_rps: 0, sent: 0 },
  orchestrator_up: false,
};

function tsLabel(ts: string | null): string {
  const d = ts ? new Date(ts) : new Date();
  const valid = !isNaN(d.getTime());
  const src = valid ? d : new Date();
  return src.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function App() {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [conn, setConn] = useState<ConnStatus>("connecting");
  const [toast, setToast] = useState<string | null>(null);

  const lastMsgAt = useRef<number>(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const pushSnapshot = useCallback((s: Snapshot) => {
    lastMsgAt.current = Date.now();
    setConn("live");
    setSnap(s);
    setHistory((prev) => {
      const point: HistoryPoint = {
        t: Date.now(),
        label: tsLabel(s.ts),
        ingest: Number(s.throughput.ingest_per_sec.toFixed(2)),
        deliver: Number(s.throughput.deliver_per_sec.toFixed(2)),
      };
      const next = [...prev, point];
      return next.length > HISTORY_LEN ? next.slice(next.length - HISTORY_LEN) : next;
    });
  }, []);

  const showError = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  // Initial paint from the snapshot endpoint, then open the SSE stream.
  useEffect(() => {
    let cancelled = false;
    fetchSnapshot()
      .then((s) => {
        if (!cancelled) pushSnapshot(s);
      })
      .catch(() => {
        // The stream will fill it in; nothing to do here.
      });

    const es = openStream(
      pushSnapshot,
      () => setConn("live"),
      () => setConn("down")
    );

    return () => {
      cancelled = true;
      es.close();
    };
  }, [pushSnapshot]);

  // Staleness watchdog: if frames stop arriving, flag the connection even when
  // EventSource has not yet emitted an error (e.g. a silently wedged proxy).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (lastMsgAt.current === 0) return;
      if (Date.now() - lastMsgAt.current > STALE_MS) {
        setConn((c) => (c === "live" ? "down" : c));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app">
      <Header conn={conn} orchestratorUp={snap.orchestrator_up} ts={snap.ts} />

      <KpiRow snap={snap} />

      <div className="layout" style={{ marginBottom: 16 }}>
        <Funnel states={snap.states} />
        <ThroughputChart history={history} />
      </div>

      <div className="layout" style={{ marginBottom: 16 }}>
        <Downstreams downstreams={snap.downstreams} />
        <Queues queues={snap.queues} brokerRetries={snap.retries.broker_retries} />
      </div>

      <Controls
        load={snap.load}
        paymentDown={snap.downstreams.payment.down}
        restaurantDown={snap.downstreams.restaurant.down}
        courierDown={snap.downstreams.courier.down}
        onError={showError}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
