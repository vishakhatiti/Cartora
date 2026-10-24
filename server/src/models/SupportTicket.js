import mongoose from 'mongoose';

export const TICKET_TOPICS = ['order', 'payment', 'delivery', 'returns', 'account', 'selling', 'other'];

// A message sent through the Customer service form. Guests give an email; signed-in users are linked by id.
const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    topic: { type: String, enum: TICKET_TOPICS, required: true },
    orderNumber: { type: String, trim: true, maxlength: 20, default: null },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    status: { type: String, enum: ['open', 'answered', 'closed'], default: 'open' },
  },
  { timestamps: true },
);

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
