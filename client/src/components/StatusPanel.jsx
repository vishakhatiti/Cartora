import { useApiStatus } from '../hooks/useApiStatus.js';

const COPY = {
  checking: {
    tone: 'text-muted',
    dot: 'bg-muted animate-pulse',
    title: 'Checking the server…',
    detail: 'The free server sleeps when idle, so the first check can take up to a minute.',
  },
  ready: {
    tone: 'text-ok',
    dot: 'bg-ok',
    title: 'API online · Database connected',
    detail: 'Everything is up. Frontend, backend and MongoDB are talking to each other.',
  },
  db_down: {
    tone: 'text-warn',
    dot: 'bg-warn',
    title: 'API online · Database unavailable',
    detail: 'The server is running but cannot reach MongoDB. Check the Atlas credentials and network access.',
  },
  unreachable: {
    tone: 'text-bad',
    dot: 'bg-bad',
    title: 'API unreachable',
    detail: 'No response from the server. It may still be waking up, or the /api rewrite may point to the wrong URL.',
  },
};

export default function StatusPanel() {
  const { status, check } = useApiStatus();
  const copy = COPY[status];

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <h2 id="status-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
        System status
      </h2>
      <div className="mt-3 flex items-start gap-3" role="status" aria-live="polite">
        <span aria-hidden="true" className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${copy.dot}`} />
        <div>
          <p className={`font-semibold ${copy.tone}`}>{copy.title}</p>
          <p className="mt-1 text-sm text-muted">{copy.detail}</p>
        </div>
      </div>
      {status !== 'checking' && (
        <button
          type="button"
          onClick={check}
          className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
        >
          Check again
        </button>
      )}
    </section>
  );
}
