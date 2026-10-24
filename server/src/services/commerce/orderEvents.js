import { orderConfirmationEmail } from '../mail/templates.js';

/**
 * Everything that happens after an order is paid or shipped: bell notifications and the confirmation email.
 * None of it may fail the order. Each step is logged on failure and the next one still runs.
 */
export function createOrderEvents({ notifications, mailer = null, appUrl = '', log = console }) {
  const orderUrl = (order) => `${appUrl}/orders/${order.id}`;
  return {
    async orderPaid(order, { userId, email, sellerIds }) {
      await notifications.notify(userId, {
        type: 'order_paid', title: 'Order confirmed', link: `/orders/${order.id}`,
        message: `Order ${order.orderNumber} is confirmed.${order.payment.demo ? ' Demo payment: no real money was charged.' : ''}`,
      });
      for (const sellerId of sellerIds) {
        await notifications.notify(sellerId, { type: 'new_order', title: 'New order to ship', link: '/sell/orders', message: `Order ${order.orderNumber} includes items from your store.` });
      }
      if (mailer && email) {
        try {
          await mailer.send({ to: email, ...orderConfirmationEmail({ order, orderUrl: orderUrl(order) }) });
        } catch (err) {
          log.error(`Order confirmation email failed for ${order.orderNumber}: ${err?.message ?? 'unknown error'}`);
        }
      }
    },
    async shipped(order, { buyerId, storeName }) {
      await notifications.notify(buyerId, {
        type: 'order_status', title: 'Items shipped', link: `/orders/${order.id}`,
        message: `${storeName} shipped items from order ${order.orderNumber}.`,
      });
    },
  };
}
