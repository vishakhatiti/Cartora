import { useId, useRef } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior.js';

/** Centered modal. Pass `busy` while an action runs so it cannot be dismissed or submitted twice. */
export default function Dialog({ open, onClose, title, children, actions, busy = false }) {
  const panel = useRef(null);
  const titleId = useId();
  useModalBehavior({ open, onClose: () => { if (!busy) onClose(); }, containerRef: panel });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-fg/40" onClick={() => { if (!busy) onClose(); }} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 id={titleId} className="text-2xl">{title}</h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Yes/no confirmation built on Dialog. `onConfirm` may be async; the dialog stays busy until it settles. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', busy = false, danger = false }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      actions={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-pale disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? 'bg-bad hover:opacity-90' : 'bg-primary text-primary-fg'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      )}
    >
      {message}
    </Dialog>
  );
}
