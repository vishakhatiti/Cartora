import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';

export const MAX_ADDRESSES = 10;

/** Saved delivery addresses. The first one saved is the default; deleting the default promotes the next one. */
export function createAddressService({ store }) {
  const normalize = (list) => {
    if (list.length > 0 && !list.some((a) => a.isDefault)) list[0].isDefault = true;
    return list;
  };
  const find = (list, id) => {
    const index = list.findIndex((a) => a.id === id);
    if (index < 0) throw new AppError(404, 'Address not found.', 'NOT_FOUND');
    return index;
  };
  const view = (list) => ({ addresses: list });

  return {
    async list(userId) {
      return view(await store.getAddresses(userId));
    },
    async add(userId, data, { makeDefault = false } = {}) {
      const list = await store.getAddresses(userId);
      if (list.length >= MAX_ADDRESSES) throw new AppError(409, `You can save up to ${MAX_ADDRESSES} addresses.`, 'ADDRESS_LIMIT');
      if (makeDefault) list.forEach((a) => { a.isDefault = false; });
      const address = { ...data, id: randomUUID(), isDefault: makeDefault || list.length === 0 };
      return view(await store.setAddresses(userId, normalize([...list, address])));
    },
    async update(userId, id, data) {
      const list = await store.getAddresses(userId);
      const index = find(list, id);
      list[index] = { ...data, id, isDefault: list[index].isDefault };
      return view(await store.setAddresses(userId, list));
    },
    async setDefault(userId, id) {
      const list = await store.getAddresses(userId);
      find(list, id);
      return view(await store.setAddresses(userId, list.map((a) => ({ ...a, isDefault: a.id === id }))));
    },
    async remove(userId, id) {
      const list = await store.getAddresses(userId);
      const index = find(list, id);
      list.splice(index, 1);
      return view(await store.setAddresses(userId, normalize(list)));
    },
  };
}
