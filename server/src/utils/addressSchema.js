import { z } from 'zod';

const text = (max) => z.string().trim().min(1, 'This field is required.').max(max);

/** Delivery address as the server accepts it. Used by checkout and the address book. */
export const addressSchema = z.object({
  name: text(80),
  line1: text(120),
  line2: z.string().trim().max(120).optional().transform((v) => v || undefined),
  city: text(80),
  state: text(80),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/, 'Enter a valid postal code.'),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code, for example US.').transform((v) => v.toUpperCase()),
});
