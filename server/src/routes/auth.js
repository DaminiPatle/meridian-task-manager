import express from 'express';
import { z } from 'zod';
import {
  checkLoginRate,
  clearLoginFailures,
  hashPassword,
  recordLoginFailure,
  signToken,
  verifyPassword,
} from '../auth.js';
import { publicUser, userByEmail, userById } from '../repo.js';
import { AppError, validate } from '../util.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRoutes(db, authenticate) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { email, password } = validate(loginSchema, req.body);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    checkLoginRate(ip, email);
    const user = userByEmail(db, email.trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(ip, email);
      throw new AppError(401, 'Incorrect email or password');
    }
    if (!user.is_active) throw new AppError(403, 'This account has been deactivated');
    clearLoginFailures(ip, email);
    res.json({ token: signToken(user.id), user: publicUser(db, user.id) });
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ user: publicUser(db, req.user.id) });
  });

  router.post('/change-password', authenticate, (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(200),
    });
    const payload = validate(schema, req.body);
    const user = userByEmail(db, req.user.email);
    if (!verifyPassword(payload.currentPassword, user.password_hash)) {
      throw new AppError(400, 'Current password is incorrect');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(payload.newPassword),
      user.id,
    );
    res.json({ ok: true });
  });

  return router;
}

export function meRoutes(db) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ user: publicUser(db, userById(db, req.user.id)) });
  });
  return router;
}
