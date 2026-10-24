import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Never returned by default. Absent for accounts that only use Google sign-in or emailed codes.
    passwordHash: { type: String, select: false },
    googleId: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    avatarUrl: { type: String, trim: true },

    // One account can both buy and sell. The Buyer/Seller switch is a UI mode; this flag
    // records that the user has created a store.
    isSeller: { type: Boolean, default: false },
    storeName: {
      type: String,
      trim: true,
      maxlength: 80,
      required: [function requireStoreName() { return this.isSeller; }, 'storeName is required for sellers'],
    },

    lastLoginAt: Date,

    // Raised on password reset so every older login token stops working.
    tokenVersion: { type: Number, default: 0, min: 0 },
    // Unverified sign-ups delete themselves after this time (MongoDB TTL), which keeps the free
    // Atlas tier from filling with abandoned registrations. Removed when the email is verified.
    purgeAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
