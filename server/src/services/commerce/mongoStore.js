import mongoose from 'mongoose';
import { Cart } from '../../models/Cart.js';
import { CheckoutSession } from '../../models/CheckoutSession.js';
import { Order } from '../../models/Order.js';
import { Wishlist } from '../../models/Wishlist.js';
import { AddressBook } from '../../models/AddressBook.js';
import { SupportTicket } from '../../models/SupportTicket.js';

const isValidId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(String(id))) === String(id);

const toSession = (doc) =>
  doc && {
    id: String(doc._id), userId: String(doc.userId), provider: doc.provider, status: doc.status,
    items: doc.items.map((i) => ({ productId: i.productId, title: i.title, brand: i.brand ?? null, image: i.image ?? null, unitPriceCents: i.unitPriceCents, qty: i.qty })),
    subtotalCents: doc.subtotalCents, shippingCents: doc.shippingCents, totalCents: doc.totalCents, currency: doc.currency,
    shippingAddress: doc.shippingAddress ?? null, failureReason: doc.failureReason ?? null, orderId: doc.orderId ?? null, createdAt: doc.createdAt,
  };

const toOrder = (doc) =>
  doc && {
    id: String(doc._id), orderNumber: doc.orderNumber, userId: String(doc.userId), status: doc.status,
    items: doc.items.map((i) => ({ productId: i.productId, title: i.title, brand: i.brand ?? null, image: i.image ?? null, unitPriceCents: i.unitPriceCents, qty: i.qty })),
    subtotalCents: doc.subtotalCents, shippingCents: doc.shippingCents, totalCents: doc.totalCents, currency: doc.currency,
    payment: { provider: doc.payment?.provider, demo: Boolean(doc.payment?.demo), sessionId: doc.payment?.sessionId },
    shippingAddress: doc.shippingAddress ?? null, paidAt: doc.paidAt ?? null,
    timeline: (doc.timeline ?? []).map((t) => ({ status: t.status, at: t.at })), createdAt: doc.createdAt,
  };

const toTicket = (doc) =>
  doc && {
    id: String(doc._id), ticketNumber: doc.ticketNumber, userId: doc.userId ? String(doc.userId) : null, name: doc.name, email: doc.email,
    topic: doc.topic, orderNumber: doc.orderNumber ?? null, message: doc.message, status: doc.status, createdAt: doc.createdAt,
  };

/** MongoDB-backed commerce store. Stores ids and quantities for carts, and snapshots for sessions and orders. */
export function createMongoCommerceStore() {
  return {
    async getCartItems(userId) {
      if (!isValidId(userId)) return [];
      const doc = await Cart.findOne({ userId }).lean();
      return (doc?.items ?? []).map((i) => ({ productId: i.productId, qty: i.qty }));
    },
    async setCartItems(userId, items) {
      if (!isValidId(userId)) return [];
      if (items.length === 0) await Cart.deleteOne({ userId });
      else await Cart.findOneAndUpdate({ userId }, { $set: { items } }, { upsert: true, runValidators: true });
      return items;
    },

    async getWishlistIds(userId) {
      if (!isValidId(userId)) return [];
      const doc = await Wishlist.findOne({ userId }).lean();
      return [...(doc?.productIds ?? [])];
    },
    async setWishlistIds(userId, ids) {
      if (!isValidId(userId)) return [];
      if (ids.length === 0) await Wishlist.deleteOne({ userId });
      else await Wishlist.findOneAndUpdate({ userId }, { $set: { productIds: ids } }, { upsert: true, runValidators: true });
      return ids;
    },

    async getAddresses(userId) {
      if (!isValidId(userId)) return [];
      const doc = await AddressBook.findOne({ userId }).lean();
      return (doc?.addresses ?? []).map((a) => ({
        id: a.id, name: a.name, line1: a.line1, ...(a.line2 ? { line2: a.line2 } : {}),
        city: a.city, state: a.state, postalCode: a.postalCode, country: a.country, isDefault: Boolean(a.isDefault),
      }));
    },
    async setAddresses(userId, addresses) {
      if (!isValidId(userId)) return [];
      if (addresses.length === 0) await AddressBook.deleteOne({ userId });
      else await AddressBook.findOneAndUpdate({ userId }, { $set: { addresses } }, { upsert: true, runValidators: true });
      return addresses;
    },

    async createTicket(data) {
      return toTicket(await SupportTicket.create(data));
    },
    async listTicketsForUser(userId) {
      if (!isValidId(userId)) return [];
      return (await SupportTicket.find({ userId }).sort({ createdAt: -1 }).limit(50).lean()).map(toTicket);
    },

    async createSession(data) {
      const doc = await CheckoutSession.create(data);
      return toSession(doc.toObject());
    },
    async findSession(id) {
      if (!isValidId(id)) return null;
      return toSession(await CheckoutSession.findById(id).lean());
    },
    async transitionSession(id, from, patch) {
      if (!isValidId(id)) return null;
      const doc = await CheckoutSession.findOneAndUpdate({ _id: id, status: from }, { $set: patch }, { returnDocument: 'after', runValidators: true }).lean();
      return toSession(doc);
    },
    async attachOrderToSession(id, orderId) {
      if (isValidId(id)) await CheckoutSession.updateOne({ _id: id }, { $set: { orderId } });
    },

    async createOrderForSession(data) {
      try {
        const doc = await Order.create(data);
        return { order: toOrder(doc.toObject()), created: true };
      } catch (err) {
        if (err?.code !== 11000) throw err;
        // The unique index on payment.sessionId already holds an order for this session: return it.
        const existing = await Order.findOne({ 'payment.sessionId': data.payment.sessionId }).lean();
        if (!existing) throw err;
        return { order: toOrder(existing), created: false };
      }
    },
    async findOrder(id) {
      if (!isValidId(id)) return null;
      return toOrder(await Order.findById(id).lean());
    },
    async listOrdersForUser(userId) {
      if (!isValidId(userId)) return [];
      return (await Order.find({ userId }).sort({ createdAt: -1 }).limit(100).lean()).map(toOrder);
    },
  };
}
