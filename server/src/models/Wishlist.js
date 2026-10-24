import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Catalogue ids (strings such as B0B53DWRVW). Only ids are stored; product data is read from the catalogue.
    productIds: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true },
);

export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
