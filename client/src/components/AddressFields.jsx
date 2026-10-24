export const EMPTY_ADDRESS = { name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US' };

const FIELDS = [
  ['name', 'Full name', 'name', 'sm:col-span-2'],
  ['line1', 'Address line 1', 'address-line1', 'sm:col-span-2'],
  ['line2', 'Address line 2 (optional)', 'address-line2', 'sm:col-span-2'],
  ['city', 'City', 'address-level2', ''],
  ['state', 'State or region', 'address-level1', ''],
  ['postalCode', 'Postal code', 'postal-code', ''],
  ['country', 'Country (2 letters)', 'country', ''],
];

/** The same checks the server makes. The server still validates everything again. */
export function validateAddress(values) {
  const errors = {};
  for (const [key, label] of FIELDS) {
    if (key !== 'line2' && !values[key].trim()) errors[key] = `${label.replace(' (optional)', '')} is required.`;
  }
  if (values.postalCode.trim() && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(values.postalCode.trim())) errors.postalCode = 'Enter a valid postal code.';
  if (values.country.trim() && !/^[A-Za-z]{2}$/.test(values.country.trim())) errors.country = 'Use a two-letter country code, for example US.';
  return errors;
}

/** Trim everything and leave out empty optional fields, ready to send. */
export const cleanAddress = (values) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([k, v]) => v !== '' && ['name', 'line1', 'line2', 'city', 'state', 'postalCode', 'country'].includes(k)));

/** A saved address from the server as form values. */
export const toFormValues = (address) => ({ ...EMPTY_ADDRESS, ...Object.fromEntries(Object.entries(address).filter(([k]) => k in EMPTY_ADDRESS)), line2: address.line2 ?? '' });

export default function AddressFields({ values, errors, onChange, idPrefix = 'addr' }) {
  const input = 'mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map(([key, label, autoComplete, span]) => (
        <div key={key} className={span}>
          <label htmlFor={`${idPrefix}-${key}`} className="text-sm font-semibold">{label}</label>
          <input id={`${idPrefix}-${key}`} value={values[key]} autoComplete={autoComplete} maxLength={120}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
            aria-invalid={errors[key] ? 'true' : undefined} aria-describedby={errors[key] ? `${idPrefix}-${key}-err` : undefined} className={input} />
          {errors[key] && <p id={`${idPrefix}-${key}-err`} className="mt-1 text-xs font-medium text-bad">{errors[key]}</p>}
        </div>
      ))}
    </div>
  );
}
