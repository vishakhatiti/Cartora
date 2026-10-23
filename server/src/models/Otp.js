import mongoose from 'mongoose';

export const OTP_PURPOSES = ['verify_email', 'login', 'reset_password'];
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

// Only a keyed hash of the code is stored, never the code itself.
const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, required: true, enum: OTP_PURPOSES },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    consumedAt: Date,
    // MongoDB deletes the document automatically once this time passes.
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

export const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
