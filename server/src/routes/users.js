import express from 'express';
import { publicUser } from '../repo.js';
import { assignableUsers, groupCandidates, visibleUsers } from '../rbac.js';
import { buildTeam } from '../reports.js';

export function userRoutes(db) {
  const router = express.Router();

  router.get('/directory', (req, res) => {
    res.json({
      canCreateTasks: req.user.role !== 'ADMIN',
      assignable: assignableUsers(db, req.user).map((u) => publicUser(db, u)),
      groupCandidates: groupCandidates(db, req.user).map((u) => publicUser(db, u)),
      users: visibleUsers(db, req.user).map((u) => publicUser(db, u)),
    });
  });

  router.get('/team', (req, res) => {
    res.json(buildTeam(db, req.user));
  });

  return router;
}
