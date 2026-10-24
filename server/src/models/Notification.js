import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, enum: ['order_paid', 'order_status', 'new_order', 'welcome', 'security'] },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    // Where the bell links to (an app path such as /orders/<id>). Always an internal path.
    link: { type: String, trim: true, maxlength: 200 },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    readAt: Date,
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
