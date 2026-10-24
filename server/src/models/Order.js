import mongoose from 'mongoose';
import { MAX_QTY_PER_ITEM } from '../utils/money.js';

export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'];

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    // Signed-in buyers have userId; guests have only guestEmail.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    guestEmail: { type: String, lowercase: true, trim: true },

    // Snapshot of each item at purchase time, so later price changes never alter old orders.
    items: {
      type: [
        {
          _id: false,
          productId: { type: String, required: true, trim: true, maxlength: 40 }, // catalogue id
          title: { type: String, required: true },
          image: String,
          unitPriceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
          qty: { type: Number, required: true, min: 1, max: MAX_QTY_PER_ITEM, validate: Number.isInteger },
          sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          brand: String,
        },
      ],
      validate: [(items) => items.length > 0, 'An order needs at least one item'],
    },

    subtotalCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'usd' },

    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    // Public order reference shown to the buyer, for example CRT-7K3M9QX2.
    orderNumber: { type: String, unique: true, sparse: true },
    // How this order was paid. provider 'demo' means a simulated payment: no money moved and no payment
    // company was involved. demo must never be true for a real Stripe payment, and vice versa.
    payment: {
      _id: false,
      provider: { type: String, enum: ['demo', 'stripe'] },
      demo: { type: Boolean, default: false },
      // The checkout session id. Unique, so a repeated "payment succeeded" event cannot create a second order.
      sessionId: { type: String, unique: true, sparse: true },
    },
    shippingAddress: addressSchema,
    paidAt: Date,
    timeline: [{ _id: false, status: { type: String, enum: ORDER_STATUSES }, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);

orderSchema.pre('validate', function requireBuyer() {
  if (!this.userId && !this.guestEmail) {
    this.invalidate('userId', 'An order needs either userId or guestEmail');
  }
});

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
