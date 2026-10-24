import { formatCount } from '../lib/format.js';

/** Star rating drawn with two overlaid rows so half stars are exact. Shows the count when given. */
export default function Stars({ value, count, className = '' }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100));
  const label = count > 0 ? `${Number(value).toFixed(1)} out of 5 stars, ${formatCount(count)} ratings` : 'Not rated yet';
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`} role="img" aria-label={label}>
      <span className="relative inline-block leading-none" aria-hidden="true">
        <span className="text-line">★★★★★</span>
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-accent" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      {count > 0 ? <span className="text-muted" aria-hidden="true">{formatCount(count)}</span> : <span className="text-muted" aria-hidden="true">No ratings</span>}
    </span>
  );
}
