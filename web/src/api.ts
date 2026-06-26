import type { Snapshot } from "./types";

// All calls are RELATIVE so they work behind the production nginx (which proxies
// `/api/` to dashboard-api) and behind the vite dev proxy alike.
const API_BASE = "/api";

/** Fetch the initial snapshot used for first paint. */
export async function fetchSnapshot(): Promise<Snapshot> {
  const res = await fetch(`${API_BASE}/snapshot`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`snapshot failed: ${res.status}`);
  }
  return (await res.json()) as Snapshot;
}

/**
 * Open the SSE stream. Returns the EventSource so the caller can close it.
 * EventSource auto-reconnects on transient errors; we surface those via
 * onError so the UI can flip its connection indicator.
 */
export function openStream(
  onSnapshot: (snap: Snapshot) => void,
  onOpen: () => void,
  onError: () => void
): EventSource {
  const es = new EventSource(`${API_BASE}/stream`);
  es.onopen = () => onOpen();
  es.onmessage = (ev) => {
    try {
      const snap = JSON.parse(ev.data) as Snapshot;
      onSnapshot(snap);
    } catch {
      // Ignore malformed frames; the next one is a second away.
    }
  };
  es.onerror = () => onError();
  return es;
}

/** POST a control action. Resolves on 2xx, rejects with the body text otherwise. */
export async function control(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
}

export const actions = {
  rush: () => control("/control/load/rush"),
  baseline: () => control("/control/load/baseline"),
  stop: () => control("/control/load/stop"),
  setRate: (rps: number) => control(`/control/load/rate?rps=${encodeURIComponent(rps)}`),
  restaurantDown: () => control("/control/downstream/restaurant/down"),
  restaurantUp: () => control("/control/downstream/restaurant/up"),
  courierDown: () => control("/control/downstream/courier/down"),
  courierUp: () => control("/control/downstream/courier/up"),
  replayDlq: (limit = 100) => control(`/admin/replay-dlq?limit=${limit}`),
};
