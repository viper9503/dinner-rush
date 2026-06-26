import type { Snapshot } from "../types";
import { actions } from "../api";
import ActionButton from "./ActionButton";

interface Props {
  load: Snapshot["load"];
  restaurantDown: boolean;
  courierDown: boolean;
  onError: (msg: string) => void;
}

function modeClass(mode: string): string {
  const m = mode.toLowerCase();
  if (m.includes("rush")) return "mode-rush";
  if (m.includes("baseline")) return "mode-baseline";
  return "mode-stopped";
}

export default function Controls({
  load,
  restaurantDown,
  courierDown,
  onError,
}: Props) {
  return (
    <div className="panel">
      <h2>Control panel</h2>
      <div className="controls">
        <div className="load-status">
          <div className="ls-item">
            <div className="ls-label">Load mode</div>
            <div className={`ls-value ${modeClass(load.mode)}`}>
              {load.mode || "unknown"}
            </div>
          </div>
          <div className="ls-item">
            <div className="ls-label">Target rps</div>
            <div className="ls-value">{load.target_rps}</div>
          </div>
          {load.current_rps !== undefined && (
            <div className="ls-item">
              <div className="ls-label">Current rps</div>
              <div className="ls-value">{load.current_rps.toFixed(1)}</div>
            </div>
          )}
          <div className="ls-item">
            <div className="ls-label">Sent (total)</div>
            <div className="ls-value">{load.sent.toLocaleString()}</div>
          </div>
        </div>

        <div className="control-group">
          <div className="g-title">Load generator</div>
          <div className="btn-row">
            <ActionButton className="rush" onClick={actions.rush} onError={onError}>
              🔥 Trigger Dinner Rush
            </ActionButton>
            <ActionButton
              className="primary"
              onClick={actions.baseline}
              onError={onError}
            >
              Baseline
            </ActionButton>
            <ActionButton onClick={actions.stop} onError={onError}>
              Stop
            </ActionButton>
          </div>
        </div>

        <div className="control-group">
          <div className="g-title">Restaurant downstream</div>
          <div className="btn-row">
            <ActionButton
              className="danger"
              onClick={actions.restaurantDown}
              onError={onError}
              disabled={restaurantDown}
            >
              Break Restaurant
            </ActionButton>
            <ActionButton
              className="restore"
              onClick={actions.restaurantUp}
              onError={onError}
              disabled={!restaurantDown}
            >
              Restore Restaurant
            </ActionButton>
          </div>
        </div>

        <div className="control-group">
          <div className="g-title">Courier downstream</div>
          <div className="btn-row">
            <ActionButton
              className="danger"
              onClick={actions.courierDown}
              onError={onError}
              disabled={courierDown}
            >
              Break Courier
            </ActionButton>
            <ActionButton
              className="restore"
              onClick={actions.courierUp}
              onError={onError}
              disabled={!courierDown}
            >
              Restore Courier
            </ActionButton>
          </div>
        </div>

        <div className="control-group">
          <div className="g-title">Recovery</div>
          <div className="btn-row">
            <ActionButton
              onClick={() => actions.replayDlq(100)}
              onError={onError}
            >
              Replay DLQ
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
