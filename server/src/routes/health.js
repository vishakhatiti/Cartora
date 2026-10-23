import { Router } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

// Liveness: the process is up. Used by uptime checks.
router.get('/', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), time: new Date().toISOString() });
});

// Readiness: the database is reachable. Render can use this as its health check.
router.get('/ready', (req, res) => {
  if (!isDbConnected()) {
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
  return res.json({ status: 'ok', database: 'connected' });
});

export default router;
