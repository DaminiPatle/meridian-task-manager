import express from 'express';
import { computeInsights } from '../ai.js';
import { listTasks } from '../workflow.js';
import { peopleInScope } from '../reports.js';

function labelFor(user) {
  if (user.role === 'ADMIN') return 'Organisation';
  if (user.role === 'SENIOR_MANAGER') return `${user.department_name} department`;
  if (user.role === 'MANAGER') return `${user.full_name}’s team`;
  return 'Your workspace';
}

export function aiRoutes(db) {
  const router = express.Router();

  router.get('/insights', async (req, res) => {
    const tasks = listTasks(db, req.user, {});
    const people = peopleInScope(db, req.user);
    const insights = await computeInsights(db, labelFor(req.user), tasks, people);
    res.json({ insights });
  });

  return router;
}
