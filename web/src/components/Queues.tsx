import type { Snapshot } from "../types";

interface Props {
  queues: Snapshot["queues"];
  brokerRetries: number;
}

export default function Queues({ queues, brokerRetries }: Props) {
  const retryHot = queues.retry > 0;
  const dlqHot = queues.dlq > 0;
  const showBanner = retryHot || dlqHot;

  return (
    <div className="panel">
      <h2>Queues &amp; resilience</h2>
      <div className="queues">
        <div className="queue-stat">
          <div className="q-label">Advance backlog</div>
          <div className="q-value">{queues.advance.toLocaleString()}</div>
        </div>
        <div className={`queue-stat${retryHot ? " hot" : ""}`}>
          <div className="q-label">Retry queue</div>
          <div className="q-value">{queues.retry.toLocaleString()}</div>
        </div>
        <div className={`queue-stat${dlqHot ? " crit" : ""}`}>
          <div className="q-label">Dead-letter</div>
          <div className="q-value">{queues.dlq.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12 }} className="muted">
        Broker retries (cumulative): {brokerRetries.toLocaleString()}
      </div>

      {showBanner && (
        <div className={`warn-banner${dlqHot ? " crit" : ""}`}>
          <span>⚠</span>
          {dlqHot ? (
            <span>
              STUCK / RETRYING — {queues.dlq.toLocaleString()} message
              {queues.dlq === 1 ? "" : "s"} in the dead-letter queue
              {retryHot ? `, ${queues.retry.toLocaleString()} retrying` : ""}.
              Replay the DLQ once downstreams recover.
            </span>
          ) : (
            <span>
              RETRYING — {queues.retry.toLocaleString()} message
              {queues.retry === 1 ? "" : "s"} backing off and retrying a flaky
              downstream.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
