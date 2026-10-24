import mongoose from 'mongoose';

// One document per signed-in user. Each address has its own string id so the API can point at it.
const addressBookSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    addresses: [
      {
        _id: false,
        id: { type: String, required: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        line1: { type: String, required: true, trim: true, maxlength: 120 },
        line2: { type: String, trim: true, maxlength: 120 },
        city: { type: String, required: true, trim: true, maxlength: 80 },
        state: { type: String, required: true, trim: true, maxlength: 80 },
        postalCode: { type: String, required: true, trim: true, maxlength: 12 },
        country: { type: String, required: true, trim: true, minlength: 2, maxlength: 2 },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

export const AddressBook = mongoose.models.AddressBook || mongoose.model('AddressBook', addressBookSchema);
