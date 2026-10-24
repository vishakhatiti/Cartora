import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { addressSchema } from '../utils/addressSchema.js';

const idParam = z.string().trim().min(1).max(64);
const createBody = z.object({ address: addressSchema, makeDefault: z.boolean().optional() });
const updateBody = z.object({ address: addressSchema });

/** The signed-in user's address book. Every address is validated with the same rules checkout uses. */
export function createAddressRouter({ addresses }) {
  const router = Router();
  const noStore = (res) => res.set('Cache-Control', 'no-store');
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

  router.get('/', requireAuth, wrap(async (req, res) => noStore(res).json(await addresses.list(req.user.id))));
  router.post('/', requireAuth, wrap(async (req, res) => {
    const { address, makeDefault } = createBody.parse(req.body);
    noStore(res).status(201).json(await addresses.add(req.user.id, address, { makeDefault }));
  }));
  router.put('/:id', requireAuth, wrap(async (req, res) => {
    noStore(res).json(await addresses.update(req.user.id, idParam.parse(req.params.id), updateBody.parse(req.body).address));
  }));
  router.post('/:id/default', requireAuth, wrap(async (req, res) => {
    noStore(res).json(await addresses.setDefault(req.user.id, idParam.parse(req.params.id)));
  }));
  router.delete('/:id', requireAuth, wrap(async (req, res) => {
    noStore(res).json(await addresses.remove(req.user.id, idParam.parse(req.params.id)));
  }));
  return router;
}
