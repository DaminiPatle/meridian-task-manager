import crypto from 'node:crypto';
import { AppError, now } from './util.js';
import { userById } from './repo.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'meridian-dev-secret-change-in-production';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [kind, salt, hash] = String(stored).split('$');
    if (kind !== 'scrypt' || !salt || !hash) return false;
    const computed = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

function signPayload(payload) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
}

export function signToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS, iat: Date.now() }),
  ).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.sub || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

const attempts = new Map();

export function checkLoginRate(ip, email) {
  const key = `${ip}:${String(email || '').toLowerCase()}`;
  const entry = attempts.get(key);
  const current = Date.now();
  if (!entry || entry.resetAt < current) {
    attempts.set(key, { count: 0, resetAt: current + 15 * 60 * 1000 });
    return;
  }
  if (entry.count >= 8) {
    throw new AppError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
  }
}

export function recordLoginFailure(ip, email) {
  const key = `${ip}:${String(email || '').toLowerCase()}`;
  const entry = attempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  entry.count += 1;
  attempts.set(key, entry);
}

export function clearLoginFailures(ip, email) {
  attempts.delete(`${ip}:${String(email || '').toLowerCase()}`);
}

export function createAuthMiddleware(db) {
  return function authenticate(req, _res, next) {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      const data = verifyToken(token);
      if (!data) throw new AppError(401, 'Sign in required');
      const user = userById(db, data.sub);
      if (!user || !user.is_active) throw new AppError(401, 'Account is inactive');
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(new AppError(401, 'Sign in required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Your role is not permitted to perform this action'));
    }
    next();
  };
}

export function recordLoginSuccess(ip, email) {
  clearLoginFailures(ip, email);
  return now();
}
