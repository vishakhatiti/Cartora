import mongoose from 'mongoose';
import { MAX_QTY_PER_ITEM } from '../utils/money.js';

export const CHECKOUT_STATUSES = ['pending', 'succeeded', 'failed'];

// One attempt to pay for a cart. It records what the server priced and who is paying; an order is created
// from it only when payment succeeds. Stripe Checkout Sessions play the same role, which is why this is
// a separate record and not an order in "pending".
const checkoutSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['demo', 'stripe'], required: true },
    status: { type: String, enum: CHECKOUT_STATUSES, default: 'pending', index: true },
    // Copied from the signed-in account when checkout starts, so the confirmation email can be sent after payment.
    buyerEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
    items: [
      {
        _id: false,
        productId: { type: String, required: true },
        title: { type: String, required: true },
        brand: String,
        image: String,
        unitPriceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
        qty: { type: Number, required: true, min: 1, max: MAX_QTY_PER_ITEM, validate: Number.isInteger },
        sellerId: { type: String, default: null },
        storeName: { type: String, default: null },
      },
    ],
    subtotalCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd' },
    shippingAddress: {
      _id: false,
      name: String, line1: String, line2: String, city: String, state: String, postalCode: String, country: String,
    },
    failureReason: String,
    orderId: String,
    // Old sessions are removed by MongoDB itself, so abandoned checkouts do not fill the free tier.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), expires: 0 },
  },
  { timestamps: true },
);

export const CheckoutSession = mongoose.models.CheckoutSession || mongoose.model('CheckoutSession', checkoutSessionSchema);
