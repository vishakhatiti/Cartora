const view = (n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, link: n.link, read: Boolean(n.readAt), createdAt: n.createdAt });

/**
 * In-app notifications (the bell). Creating one never blocks the action that caused it: a failure is logged
 * and the order, shipment or payment still goes through.
 */
export function createNotificationService({ store, log = console }) {
  return {
    async notify(userId, { type, title, message, link }) {
      try {
        await store.createNotification({ userId, type, title, message, link });
      } catch (err) {
        log.error(`Notification failed: ${err?.message ?? 'unknown error'}`);
      }
    },
    async list(userId) {
      const [items, unread] = await Promise.all([store.listNotifications(userId), store.countUnreadNotifications(userId)]);
      return { items: items.map(view), unread };
    },
    async markAllRead(userId) {
      await store.markNotificationsRead(userId);
      return this.list(userId);
    },
  };
}
