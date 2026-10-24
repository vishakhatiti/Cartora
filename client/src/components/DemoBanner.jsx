/** Shown on every checkout screen while payments are simulated. The wording comes from the server's setting. */
export default function DemoBanner({ label = 'Demo Mode — No Real Money Charged' }) {
  return (
    <div role="note" className="rounded-2xl border-2 border-dashed border-warn bg-butter px-4 py-3 text-center text-sm font-bold text-fg">
      <span aria-hidden="true">⚠ </span>{label}
      <span className="block text-xs font-medium text-muted">Payments here are simulated. No card is requested and no payment company is contacted.</span>
    </div>
  );
}
