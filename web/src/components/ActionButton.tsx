import { useState } from "react";

interface Props {
  onClick: () => Promise<void>;
  className?: string;
  children: React.ReactNode;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

/**
 * A button that calls an async action, disabling itself and showing a brief
 * spinner while in flight so every control gives immediate visual feedback.
 */
export default function ActionButton({
  onClick,
  className,
  children,
  onError,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      await onClick();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(msg);
    } finally {
      // Keep the spinner visible just long enough to read as feedback.
      setTimeout(() => setBusy(false), 350);
    }
  }

  return (
    <button
      className={`btn ${className ?? ""}`}
      onClick={handle}
      disabled={busy || disabled}
    >
      {busy && <span className="spinner" />}
      {children}
    </button>
  );
}
