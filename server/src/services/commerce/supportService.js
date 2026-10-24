import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const ticketNumber = () => `SUP-${[...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;

export const ticketView = (t) => ({
  id: t.id, ticketNumber: t.ticketNumber, topic: t.topic, orderNumber: t.orderNumber, message: t.message, status: t.status, createdAt: t.createdAt,
});

/** Customer service requests. They are stored for the team; nothing here claims a reply time. */
export function createSupportService({ store }) {
  return {
    async create(user, data) {
      const ticket = await store.createTicket({
        ...data, ticketNumber: ticketNumber(), userId: user?.id ?? null,
        // A signed-in user's account email is used, so nobody can open tickets in someone else's name.
        email: user?.email ?? data.email, name: data.name,
      });
      return ticketView(ticket);
    },
    async listMine(userId) {
      return (await store.listTicketsForUser(userId)).map(ticketView);
    },
  };
}
