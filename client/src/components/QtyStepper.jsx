/** Quantity control: minus, number, plus. Disabled while a change is being saved. */
export default function QtyStepper({ value, onChange, disabled = false, label = 'Quantity', max = 10 }) {
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-lg font-semibold hover:bg-pale disabled:opacity-40';
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-2">
      <button type="button" className={btn} aria-label="Decrease quantity" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <span className="min-w-8 text-center font-semibold" aria-live="polite">{value}</span>
      <button type="button" className={btn} aria-label="Increase quantity" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
