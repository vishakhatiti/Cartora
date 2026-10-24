import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);
const LIFETIME_MS = 5000;

const STYLES = {
  success: 'border-ok text-ok',
  error: 'border-bad text-bad',
  info: 'border-primary text-primary',
};

/** Toast messages for results of user actions. Success and info are announced politely, errors assertively. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback((kind, message) => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), LIFETIME_MS);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m) => show('success', m),
    error: (m) => show('error', m),
    info: (m) => show('info', m),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border-l-4 bg-surface p-3 pr-2 text-sm shadow-lg ring-1 ring-line ${STYLES[t.kind]}`}
            >
              <p className="flex-1 pt-0.5 text-fg">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss message"
                className="rounded-md px-2 py-1 text-muted hover:bg-bg hover:text-fg"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
