import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Real Cartora users have userId. Reviews that came with the product data have
    // legacyReviewerId instead and no account.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    legacyReviewerId: { type: String, trim: true },
    reviewerName: { type: String, trim: true, maxlength: 80, default: 'Customer' },

    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    title: { type: String, trim: true, maxlength: 150 },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    verifiedPurchase: { type: Boolean, default: false },
    helpfulVotes: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

reviewSchema.pre('validate', function requireReviewer() {
  if (!this.userId && !this.legacyReviewerId) {
    this.invalidate('userId', 'A review needs either userId or legacyReviewerId');
  }
});

// One review per real user per product.
reviewSchema.index(
  { productId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
reviewSchema.index({ productId: 1, createdAt: -1 });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
