import express from 'express';
import { buildApprovals } from '../workflow.js';

export function approvalRoutes(db) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json(buildApprovals(db, req.user));
  });
  return router;
}
