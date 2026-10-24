import { useRef } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior.js';

/** Slide-out panel from the left. Backdrop click, Escape and the close button all close it. */
export default function Drawer({ open, onClose, title, children }) {
  const panel = useRef(null);
  useModalBehavior({ open, onClose, containerRef: panel });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-fg/40" onClick={onClose} aria-hidden="true" data-testid="drawer-backdrop" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between bg-primary px-4 py-4 text-primary-fg">
          <p className="font-display text-xl">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg px-2 py-1 text-2xl leading-none hover:bg-primary-fg/15">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
