import mongoose from 'mongoose';
import { Cart } from '../../models/Cart.js';
import { CheckoutSession } from '../../models/CheckoutSession.js';
import { Order } from '../../models/Order.js';
import { Product } from '../../models/Product.js';
import { Wishlist } from '../../models/Wishlist.js';
import { AddressBook } from '../../models/AddressBook.js';
import { SupportTicket } from '../../models/SupportTicket.js';
import { Notification } from '../../models/Notification.js';

const isValidId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(String(id))) === String(id);

const toItem = (i) => ({
  productId: i.productId, title: i.title, brand: i.brand ?? null, image: i.image ?? null, unitPriceCents: i.unitPriceCents, qty: i.qty,
  sellerId: i.sellerId ?? null, storeName: i.storeName ?? null, fulfilment: i.fulfilment ?? 'pending', shippedAt: i.shippedAt ?? null,
});

const toListing = (doc) =>
  doc && {
    id: doc.asin, sellerId: String(doc.sellerId), storeName: doc.storeName, title: doc.title, brand: doc.brand ?? '',
    category: { slug: doc.category, label: doc.categoryLabel || doc.category }, priceCents: doc.priceCents,
    description: doc.description ?? '', features: [...(doc.features ?? [])],
    images: (doc.images ?? []).map((i) => ({ thumb: i.thumb || i.large, large: i.large })),
    stockQty: doc.stock, isActive: doc.isActive, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };

const toSession = (doc) =>
  doc && {
    id: String(doc._id), userId: String(doc.userId), buyerEmail: doc.buyerEmail ?? null, provider: doc.provider, status: doc.status,
    items: doc.items.map(toItem),
    subtotalCents: doc.subtotalCents, shippingCents: doc.shippingCents, totalCents: doc.totalCents, currency: doc.currency,
    shippingAddress: doc.shippingAddress ?? null, failureReason: doc.failureReason ?? null, orderId: doc.orderId ?? null, createdAt: doc.createdAt,
  };

const toOrder = (doc) =>
  doc && {
    id: String(doc._id), orderNumber: doc.orderNumber, userId: String(doc.userId), status: doc.status,
    items: doc.items.map(toItem),
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

const toNotification = (doc) =>
  doc && {
    id: String(doc._id), userId: String(doc.userId), type: doc.type, title: doc.title, message: doc.message,
    link: doc.link ?? null, readAt: doc.readAt ?? null, createdAt: doc.createdAt,
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
      return (await SupportTicket.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(50).lean()).map(toTicket);
    },

    // ---- seller listings (stored in the products collection with a sellerId)
    async createListing(data) {
      const doc = await Product.create({
        asin: data.id, title: data.title, brand: data.brand, category: data.category.slug, categoryLabel: data.category.label,
        description: data.description, features: data.features, images: data.images, priceCents: data.priceCents,
        stock: data.stockQty, sellerId: data.sellerId, storeName: data.storeName, isActive: true,
      });
      return toListing(doc.toObject());
    },
    async updateListing(id, sellerId, patch) {
      if (!isValidId(sellerId)) return null;
      const set = {};
      if ('title' in patch) set.title = patch.title;
      if ('brand' in patch) set.brand = patch.brand;
      if ('category' in patch) { set.category = patch.category.slug; set.categoryLabel = patch.category.label; }
      if ('description' in patch) set.description = patch.description;
      if ('features' in patch) set.features = patch.features;
      if ('images' in patch) set.images = patch.images;
      if ('priceCents' in patch) set.priceCents = patch.priceCents;
      if ('stockQty' in patch) set.stock = patch.stockQty;
      if ('isActive' in patch) set.isActive = patch.isActive;
      return toListing(await Product.findOneAndUpdate({ asin: id, sellerId }, { $set: set }, { new: true, runValidators: true }).lean());
    },
    async findListing(id) {
      return toListing(await Product.findOne({ asin: id, sellerId: { $ne: null } }).lean());
    },
    async listListingsForSeller(sellerId) {
      if (!isValidId(sellerId)) return [];
      return (await Product.find({ sellerId }).sort({ createdAt: -1, _id: -1 }).limit(500).lean()).map(toListing);
    },
    async listActiveListings() {
      return (await Product.find({ sellerId: { $ne: null }, isActive: true }).lean()).map(toListing);
    },
    /** Subtract purchased quantities from seller listings (never below zero) and return the changed listings. Dataset products have no tracked stock. */
    async consumeStock(items) {
      const ids = [];
      for (const item of items) {
        if (!item.sellerId || !isValidId(item.sellerId)) continue;
        await Product.updateOne({ asin: item.productId, sellerId: item.sellerId, stock: { $gte: item.qty } }, { $inc: { stock: -item.qty } });
        await Product.updateOne({ asin: item.productId, sellerId: item.sellerId, stock: { $lt: item.qty } }, { $set: { stock: 0 } });
        ids.push(item.productId);
      }
      return ids.length ? (await Product.find({ asin: { $in: ids } }).lean()).map(toListing) : [];
    },

    async listOrdersForSeller(sellerId) {
      return (await Order.find({ 'items.sellerId': String(sellerId), status: { $ne: 'pending' } }).sort({ createdAt: -1, _id: -1 }).limit(200).lean()).map(toOrder);
    },
    /** Mark one seller's items in an order as shipped. The order becomes shipped once every item is. */
    async markSellerItemsShipped(orderId, sellerId, at) {
      if (!isValidId(orderId)) return null;
      const order = await Order.findOne({ _id: orderId, 'items.sellerId': String(sellerId) });
      if (!order) return null;
      for (const item of order.items) if (item.sellerId === String(sellerId) && item.fulfilment !== 'shipped') { item.fulfilment = 'shipped'; item.shippedAt = at; }
      if (order.items.every((i) => i.fulfilment === 'shipped') && order.status === 'paid') { order.status = 'shipped'; order.timeline.push({ status: 'shipped', at }); }
      await order.save();
      return toOrder(order.toObject());
    },

    async createNotification(data) {
      return toNotification((await Notification.create(data)).toObject());
    },
    async listNotifications(userId) {
      if (!isValidId(userId)) return [];
      return (await Notification.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(30).lean()).map(toNotification);
    },
    async countUnreadNotifications(userId) {
      if (!isValidId(userId)) return 0;
      return Notification.countDocuments({ userId, readAt: { $exists: false } });
    },
    async markNotificationsRead(userId) {
      if (!isValidId(userId)) return;
      await Notification.updateMany({ userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
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
      return (await Order.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(100).lean()).map(toOrder);
    },
  };
}
