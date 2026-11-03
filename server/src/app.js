import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { createAuthMiddleware } from './auth.js';
import { AppError } from './util.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { taskRoutes, extensionRoutes } from './routes/tasks.js';
import { approvalRoutes } from './routes/approvals.js';
import { reportRoutes } from './routes/reports.js';
import { meetingRoutes } from './routes/meetings.js';
import { aiRoutes } from './routes/ai.js';
import { notificationRoutes } from './routes/notifications.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { adminRoutes } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
  app.use(express.json({ limit: '2mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const authenticate = createAuthMiddleware(db);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'meridian', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes(db, authenticate));
  app.use('/api/users', authenticate, userRoutes(db));
  app.use('/api/tasks', authenticate, taskRoutes(db));
  app.use('/api/extensions', authenticate, extensionRoutes(db));
  app.use('/api/approvals', authenticate, approvalRoutes(db));
  app.use('/api/reports', authenticate, reportRoutes(db));
  app.use('/api/meetings', authenticate, meetingRoutes(db));
  app.use('/api/ai', authenticate, aiRoutes(db));
  app.use('/api/notifications', authenticate, notificationRoutes(db));
  app.use('/api/dashboard', authenticate, dashboardRoutes(db));
  app.use('/api/admin', authenticate, adminRoutes(db));

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'API route not found'));
  });

  const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
  const indexHtml = path.join(webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(indexHtml);
      }
      next();
    });
  }

  app.use((error, _req, res, _next) => {
    const status = error instanceof AppError ? error.status : Number(error.status) || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error: status >= 500 ? 'Unexpected server error' : error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  });

  return app;
}
