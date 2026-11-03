import express from 'express';
import { buildDashboard } from '../dashboard.js';

export function dashboardRoutes(db) {
  const router = express.Router();
  router.get('/', async (req, res) => {
    res.json(await buildDashboard(db, req.user));
  });
  return router;
}
