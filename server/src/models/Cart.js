import mongoose from 'mongoose';
import { MAX_QTY_PER_ITEM } from '../utils/money.js';

// Signed-in users only. Guests keep their cart in the browser and merge it at login.
const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        qty: { type: Number, required: true, min: 1, max: MAX_QTY_PER_ITEM, validate: Number.isInteger },
      },
    ],
  },
  { timestamps: true },
);

export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
