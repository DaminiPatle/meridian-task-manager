import express from 'express';
import { buildReport, buildTeam } from '../reports.js';

export function reportRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(
      buildReport(db, req.user, {
        targetUserId: req.query.userId,
        from: req.query.from,
        to: req.query.to,
      }),
    );
  });

  router.get('/team', (req, res) => {
    res.json(buildTeam(db, req.user));
  });

  return router;
}
