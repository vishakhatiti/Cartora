import mongoose from 'mongoose';
import { effectivePriceCents } from '../utils/money.js';

const imageSchema = new mongoose.Schema(
  {
    thumb: { type: String, trim: true },
    large: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    asin: { type: String, required: true, unique: true, trim: true }, // catalog id (parent_asin)
    title: { type: String, required: true, trim: true, maxlength: 300 },
    brand: { type: String, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 4000 },
    features: { type: [String], default: [] },
    // Key/value specifications such as Color or Material.
    details: { type: Map, of: String, default: {} },
    images: { type: [imageSchema], default: [] },

    priceCents: { type: Number, required: true, min: 0, validate: Number.isInteger },
    deal: {
      percent: { type: Number, min: 0, max: 90, default: 0 },
      salePriceCents: { type: Number, min: 0, validate: Number.isInteger },
    },

    ratingAvg: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    // Number of reviews for each star rating, used for the rating breakdown bars.
    ratingBreakdown: {
      1: { type: Number, min: 0, default: 0 },
      2: { type: Number, min: 0, default: 0 },
      3: { type: Number, min: 0, default: 0 },
      4: { type: Number, min: 0, default: 0 },
      5: { type: Number, min: 0, default: 0 },
    },

    stock: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    // null seller = Cartora Marketplace (seeded catalog). Otherwise a user's store.
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    storeName: { type: String, trim: true, default: 'Cartora Marketplace' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ title: 'text', brand: 'text' });
productSchema.index({ category: 1, priceCents: 1 });
productSchema.index({ category: 1, ratingAvg: -1 });

productSchema.virtual('effectivePriceCents').get(function getEffectivePrice() {
  return effectivePriceCents({ priceCents: this.priceCents, deal: this.deal });
});

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
